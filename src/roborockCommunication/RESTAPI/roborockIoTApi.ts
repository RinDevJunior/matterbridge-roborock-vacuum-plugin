import axios, { AxiosInstance } from 'axios';
import type { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import https from 'node:https';
import crypto from 'node:crypto';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ApiResponse } from '../Zmodel/apiResponse.js';
import { Home } from '../Zmodel/home.js';
import { UserData } from '../Zmodel/userData.js';
import { Scene } from '../Zmodel/scene.js';

export class RoborockIoTApi {
  logger: AnsiLogger;
  private readonly api: AxiosInstance;
  private readonly vacuumNeedAPIV3 = ['roborock.vacuum.ss07'];

  constructor(userdata: UserData, logger: AnsiLogger) {
    this.logger = logger;

    this.api = axios.create({ baseURL: userdata.rriot.r.a, timeout: 10000, maxRedirects: 5, httpsAgent: new https.Agent({ keepAlive: true }) });

    // Retry transient network errors (including ECONNRESET) with exponential backoff
    try {
      axiosRetry(this.api, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error: unknown) => {
          const errTyped = error as { code?: string; message?: string } | AxiosError;
          const isNetwork = axiosRetry.isNetworkOrIdempotentRequestError(errTyped as unknown as Error);
          const code = (errTyped as { code?: string })?.code as string | undefined;
          const isEconnreset = code === 'ECONNRESET';
          const isTimedOut = code === 'ETIMEDOUT' || code === 'ECONNABORTED' || /timeout/i.test((errTyped as { message?: string })?.message ?? '');
          return Boolean(isNetwork || isEconnreset || isTimedOut);
        },
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to configure axios-retry: ${err ? debugStringify(err) : 'unknown'}`);
    }

    this.api.interceptors.request.use((config) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto
          .randomBytes(6)
          .toString('base64')
          .substring(0, 6)
          .replace(/[+/]/g, (m) => (m === '+' ? 'X' : 'Y'));
        const url = this.api ? new URL(this.api.getUri(config)).pathname : '';
        const data = [userdata.rriot.u, userdata.rriot.s, nonce, timestamp, crypto.createHash('md5').update(url).digest('hex'), '', ''].join(':');
        const hmac = crypto.createHmac('sha256', userdata.rriot.h).update(data).digest('base64');
        config.headers['Authorization'] = `Hawk id="${userdata.rriot.u}", s="${userdata.rriot.s}", ts="${timestamp}", nonce="${nonce}", mac="${hmac}"`;
      } catch (error) {
        this.logger.error(`Failed to initialize RESTAPI ${error ? debugStringify(error) : 'undefined'}`);
      }
      return config;
    });
  }

  public async getHomeWithProducts(homeId: number): Promise<Home | undefined> {
    const homeData = await this.getHome(homeId);
    if (!homeData) {
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    }

    if (homeData.products.some((p) => this.vacuumNeedAPIV3.includes(p.model))) {
      this.logger.debug('Using v3 API for home data retrieval');
      const homeDataV3 = await this.getHomev3(homeId);
      if (!homeDataV3) {
        throw new Error('Failed to retrieve the home data from v3 API');
      }
      homeData.devices = [...homeData.devices, ...homeDataV3.devices.filter((d) => !homeData.devices.some((x) => x.duid === d.duid))];
      homeData.receivedDevices = [...homeData.receivedDevices, ...homeDataV3.receivedDevices.filter((d) => !homeData.receivedDevices.some((x) => x.duid === d.duid))];
    }

    if (homeData.rooms.length === 0) {
      const homeDataV2 = await this.getHomev2(homeId);
      if (homeDataV2 && homeDataV2.rooms && homeDataV2.rooms.length > 0) {
        homeData.rooms = homeDataV2.rooms;
      } else {
        const homeDataV3 = await this.getHomev3(homeId);
        if (homeDataV3 && homeDataV3.rooms && homeDataV3.rooms.length > 0) {
          homeData.rooms = homeDataV3.rooms;
        }
      }
    }

    return homeData;
  }

  public async getHome(homeId: number): Promise<Home | undefined> {
    try {
      const result = await this.api.get(`user/homes/${homeId}`);
      const apiResponse: ApiResponse<Home> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`getHome failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getHomev2(homeId: number): Promise<Home | undefined> {
    try {
      const result = await this.api.get('v2/user/homes/' + homeId);
      const apiResponse: ApiResponse<Home> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`getHomev2 failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getHomev3(homeId: number): Promise<Home | undefined> {
    try {
      const result = await this.api.get('v3/user/homes/' + homeId); // can be v3 also
      const apiResponse: ApiResponse<Home> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`getHomev3 failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    try {
      const result = await this.api.get('user/scene/home/' + homeId);
      const apiResponse: ApiResponse<Scene[]> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to retrieve scene');
      return undefined;
    } catch (error) {
      this.logger.error(`getScenes failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async startScene(sceneId: number): Promise<unknown> {
    try {
      const result = await this.api.post(`user/scene/${sceneId}/execute`);
      const apiResponse: ApiResponse<unknown> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to execute scene');
      return undefined;
    } catch (error) {
      this.logger.error(`startScene failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getCustom(url: string): Promise<unknown> {
    try {
      const result = await this.api.get(url);
      const apiResponse: ApiResponse<unknown> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('Failed to execute scene');
      return undefined;
    } catch (error) {
      this.logger.error(`getCustom failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }
}
