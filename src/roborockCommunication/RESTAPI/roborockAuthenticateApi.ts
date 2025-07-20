import axios, { AxiosInstance, AxiosStatic } from 'axios';
import crypto from 'node:crypto';
import { AnsiLogger } from 'matterbridge/logger';
import { URLSearchParams } from 'node:url';
import { AuthenticateResponse } from '../Zmodel/authenticateResponse.js';
import { BaseUrl } from '../Zmodel/baseURL.js';
import { HomeInfo } from '../Zmodel/homeInfo.js';
import { UserData } from '../Zmodel/userData.js';

export class RoborockAuthenticateApi {
  private readonly logger: AnsiLogger;
  private axiosFactory: AxiosStatic;
  private deviceId: string;
  private username?: string;
  private authToken?: string;

  constructor(logger: AnsiLogger, axiosFactory: AxiosStatic = axios) {
    this.deviceId = crypto.randomUUID();
    this.axiosFactory = axiosFactory;
    this.logger = logger;
  }

  public async loginWithUserData(username: string, userData: UserData): Promise<UserData> {
    this.loginWithAuthToken(username, userData.token);
    return userData;
  }

  public async loginWithPassword(username: string, password: string): Promise<UserData> {
    const api = await this.getAPIFor(username);
    const response = await api.post(
      'api/v1/login',
      new URLSearchParams({
        username: username,
        password: password,
        needtwostepauth: 'false',
      }).toString(),
    );
    return this.auth(username, response.data);
  }

  public async getHomeDetails(): Promise<HomeInfo | undefined> {
    if (!this.username || !this.authToken) {
      return undefined;
    }

    const api = await this.getAPIFor(this.username);
    const response = await api.get('api/v1/getHomeDetail');

    const apiResponse: AuthenticateResponse<HomeInfo> = response.data;
    if (!apiResponse.data) {
      throw new Error('Failed to retrieve the home details');
    }
    return apiResponse.data;
  }

  private async getAPIFor(username: string): Promise<AxiosInstance> {
    const baseUrl = await this.getBaseUrl(username);
    return this.apiForUser(username, baseUrl);
  }

  private async getBaseUrl(username: string): Promise<string> {
    const api = await this.apiForUser(username);
    const response = await api.post(
      'api/v1/getUrlByEmail',
      new URLSearchParams({
        email: username,
        needtwostepauth: 'false',
      }).toString(),
    );

    const apiResponse: AuthenticateResponse<BaseUrl> = response.data;
    if (!apiResponse.data) {
      throw new Error('Failed to retrieve base URL: ' + apiResponse.msg);
    }

    return apiResponse.data.url;
  }

  private async apiForUser(username: string, baseUrl = 'https://usiot.roborock.com'): Promise<AxiosInstance> {
    return this.axiosFactory.create({
      baseURL: baseUrl,
      headers: {
        header_clientid: crypto.createHash('md5').update(username).update(this.deviceId).digest('base64'),
        Authorization: this.authToken,
      },
    });
  }

  private auth(username: string, response: AuthenticateResponse<UserData>): UserData {
    const userdata = response.data;
    if (!userdata || !userdata.token) {
      throw new Error('Authentication failed: ' + response.msg + ' code: ' + response.code);
    }

    this.loginWithAuthToken(username, userdata.token);
    return userdata;
  }

  private loginWithAuthToken(username: string, token: string): void {
    this.username = username;
    this.authToken = token;
  }
}
