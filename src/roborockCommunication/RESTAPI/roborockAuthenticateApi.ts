import axios, { AxiosInstance, AxiosStatic } from 'axios';
import crypto from 'node:crypto';
import { AnsiLogger } from 'matterbridge/logger';
import { URLSearchParams } from 'node:url';
import { AuthenticateResponse } from '../Zmodel/authenticateResponse.js';
import { BaseUrl } from '../Zmodel/baseURL.js';
import { HomeInfo } from '../Zmodel/homeInfo.js';
import { UserData } from '../Zmodel/userData.js';
import { AuthenticateResponseCode } from '../Zenum/authenticateResponseCode.js';

export class RoborockAuthenticateApi {
  private readonly logger: AnsiLogger;
  private axiosFactory: AxiosStatic;
  private deviceId: string;
  private username?: string;
  private authToken?: string;
  private readonly baseUrl: string;
  // Cached values from base URL lookup for v4 login
  private cachedBaseUrl?: string;
  private cachedCountry?: string;
  private cachedCountryCode?: string;

  constructor(logger: AnsiLogger, axiosFactory: AxiosStatic = axios, deviceId?: string, baseUrl = 'https://usiot.roborock.com') {
    this.deviceId = deviceId ?? crypto.randomUUID();
    this.axiosFactory = axiosFactory;
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  public async loginWithUserData(username: string, userData: UserData): Promise<UserData> {
    this.loginWithAuthToken(username, userData.token);
    return userData;
  }

  /**
   * @deprecated Use requestCodeV4 and loginWithCodeV4 instead
   */
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

  /**
   * Request a verification code to be sent to the user's email
   * @param email - The user's email address
   * @throws Error if the account is not found, rate limited, or other API error
   */
  public async requestCodeV4(email: string): Promise<void> {
    const api = await this.getAPIFor(email);
    const response = await api.post(
      'api/v4/email/code/send',
      new URLSearchParams({
        email: email,
        type: 'login',
        platform: '',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const apiResponse: AuthenticateResponse<unknown> = response.data;

    if (apiResponse.code === AuthenticateResponseCode.AccountNotFound) {
      throw new Error(`Account not found for email: ${email}`);
    }
    if (apiResponse.code === AuthenticateResponseCode.RateLimited) {
      throw new Error('Rate limited. Please wait before requesting another code.');
    }
    if (apiResponse.code !== AuthenticateResponseCode.Success && apiResponse.code !== undefined) {
      throw new Error(`Failed to send verification code: ${apiResponse.msg} (code: ${apiResponse.code})`);
    }

    this.logger.debug('Verification code requested successfully');
  }

  /**
   * Login with a verification code received via email
   * @param email - The user's email address
   * @param code - The 6-digit verification code
   * @returns UserData on successful authentication
   * @throws Error if the code is invalid, rate limited, or other API error
   */
  public async loginWithCodeV4(email: string, code: string): Promise<UserData> {
    const api = await this.getAPIFor(email);

    // Generate x_mercy_ks (random 16-char alphanumeric string)
    const xMercyKs = this.generateRandomString(16);

    // Get signed key from API
    const xMercyK = await this.signKeyV3(api, xMercyKs);

    // Fallback for missing country info to avoid 1002 parameter error
    let country = this.cachedCountry;
    let countryCode = this.cachedCountryCode;
    if (!country || !countryCode) {
      if (this.baseUrl.includes('euiot')) {
        country ??= 'Germany';
        countryCode ??= 'DE';
      } else if (this.baseUrl.includes('usiot')) {
        country ??= 'United States';
        countryCode ??= 'US';
      } else if (this.baseUrl.includes('cniot')) {
        country ??= 'China';
        countryCode ??= 'CN';
      } else if (this.baseUrl.includes('ruiot')) {
        country ??= 'Russia';
        countryCode ??= 'RU';
      }
    }

    const response = await api.post('api/v4/auth/email/login/code', null, {
      params: {
        email: email,
        code: code,
        country: country ?? '',
        countryCode: countryCode ?? '',
        majorVersion: '14',
        minorVersion: '0',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-mercy-ks': xMercyKs,
        'x-mercy-k': xMercyK,
        header_appversion: '4.54.02',
        header_phonesystem: 'iOS',
        header_phonemodel: 'iPhone16,1',
      },
    });

    return this.authV4(email, response.data);
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

  /**
   * Get cached country info from the last base URL lookup
   */
  public getCachedCountryInfo(): { country?: string; countryCode?: string } {
    return {
      country: this.cachedCountry,
      countryCode: this.cachedCountryCode,
    };
  }

  private async getAPIFor(username: string): Promise<AxiosInstance> {
    const baseUrl = await this.getBaseUrl(username);
    return this.apiForUser(username, baseUrl);
  }

  private async getBaseUrl(username: string): Promise<string> {
    if (this.cachedBaseUrl && this.username === username) {
      return this.cachedBaseUrl;
    }

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
      throw new Error(`Failed to retrieve base URL: ${apiResponse.msg ?? ''}`);
    }

    this.cachedBaseUrl = apiResponse.data.url;
    this.cachedCountry = apiResponse.data.country;
    this.cachedCountryCode = apiResponse.data.countrycode;
    this.username = username;

    return apiResponse.data.url;
  }

  private async apiForUser(username: string, baseUrl = this.baseUrl): Promise<AxiosInstance> {
    const instance = this.axiosFactory.create({
      baseURL: baseUrl,
      headers: {
        header_clientid: crypto.createHash('md5').update(username).update(this.deviceId).digest('base64'),
        Authorization: this.authToken,
        header_clientlang: 'en',
      },
    });

    instance.interceptors.request.use((config) => {
      this.logger.debug('=== HTTP Request ===');
      this.logger.debug(`URL: ${config.baseURL}/${config.url}`);
      this.logger.debug(`Method: ${config.method?.toUpperCase()}`);
      this.logger.debug(`Params: ${JSON.stringify(config.params)}`);
      this.logger.debug(`Data: ${JSON.stringify(config.data)}`);
      this.logger.debug(`Headers: ${JSON.stringify(config.headers)}`);
      return config;
    });

    instance.interceptors.response.use(
      (response) => {
        this.logger.debug('=== HTTP Response ===');
        this.logger.debug(`Status: ${response.status}`);
        this.logger.debug(`Data: ${JSON.stringify(response.data)}`);
        return response;
      },
      (error) => {
        this.logger.debug('=== HTTP Error ===');
        this.logger.debug(`Error: ${JSON.stringify(error.response?.data ?? error.message)}`);
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      },
    );

    return instance;
  }

  private auth(username: string, response: AuthenticateResponse<UserData>): UserData {
    const userdata = response.data;
    if (!userdata?.token) {
      throw new Error(`Authentication failed: ${response.msg ?? ''} code: ${response.code}`);
    }

    this.loginWithAuthToken(username, userdata.token);
    return userdata;
  }

  /**
   * Handle v4 authentication response with specific error code handling
   */
  private authV4(email: string, response: AuthenticateResponse<UserData>): UserData {
    if (response.code === AuthenticateResponseCode.InvalidCode) {
      throw new Error('Invalid verification code. Please check and try again.');
    }
    if (response.code === AuthenticateResponseCode.RateLimited) {
      throw new Error('Rate limited. Please wait before trying again.');
    }

    const userdata = response.data;
    if (!userdata?.token) {
      throw new Error(`Authentication failed: ${response.msg ?? ''} code: ${response.code}`);
    }

    this.loginWithAuthToken(email, userdata.token);
    return userdata;
  }

  private loginWithAuthToken(username: string, token: string): void {
    this.username = username;
    this.authToken = token;
  }

  /**
   * Generate a random alphanumeric string of specified length
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Sign a key using the v3 API endpoint
   */
  private async signKeyV3(api: AxiosInstance, s: string): Promise<string> {
    const response = await api.post('api/v3/key/sign', null, {
      params: { s },
    });

    const apiResponse: AuthenticateResponse<{ k: string }> = response.data;
    if (!apiResponse.data?.k) {
      throw new Error(`Failed to sign key: ${apiResponse.msg ?? ''}`);
    }

    return apiResponse.data.k;
  }
}
