import { default as axios, AxiosInstance, AxiosError, AxiosStatic } from 'axios';
import axiosRetry from 'axios-retry';
import https from 'node:https';
import crypto from 'node:crypto';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ApiResponse, Home, UserData, Scene } from '../models/index.js';
import * as AxiosLogger from 'axios-logger';

export class RoborockIoTApi {
  logger: AnsiLogger;
  private readonly api: AxiosInstance;
  private readonly vacuumNeedAPIV3 = ['roborock.vacuum.ss07']; // Q10 S5 Plus

  constructor(userdata: UserData, logger: AnsiLogger, axiosFactory: AxiosStatic = axios) {
    this.logger = logger;

    this.api = axiosFactory.create({ baseURL: userdata.rriot.r.a, timeout: 10000, maxRedirects: 5, httpsAgent: new https.Agent({ keepAlive: true }) });

    // Retry transient network errors (including ECONNRESET) with exponential backoff
    try {
      axiosRetry(this.api, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error: unknown) => {
          const errTyped = error as AxiosError;
          const isNetwork = axiosRetry.isNetworkOrIdempotentRequestError(errTyped);
          const code = errTyped?.code;
          const isEconnreset = code === 'ECONNRESET';
          const isTimedOut = code === 'ETIMEDOUT' || code === 'ECONNABORTED' || /timeout/i.test(errTyped?.message ?? '');
          return Boolean(isNetwork || isEconnreset || isTimedOut);
        },
        onRetry: (retryCount: number, error: unknown, _requestConfig: unknown) => {
          this.logger.warn(`Retrying request, attempt #${retryCount} due to error: ${error ? debugStringify(error) : 'unknown'}`);
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
        config.headers.Authorization = `Hawk id="${userdata.rriot.u}", s="${userdata.rriot.s}", ts="${timestamp}", nonce="${nonce}", mac="${hmac}"`;
      } catch (error) {
        this.logger.error(`Failed to initialize RESTAPI ${error ? debugStringify(error) : 'undefined'}`);
      }
      return config;
    });

    this.api.interceptors.request.use((request) => {
      return AxiosLogger.requestLogger(request, {
        prefixText: 'Roborock IoT API',
        dateFormat: 'HH:MM:ss',
        headers: true,
        data: true,
        method: true,
        url: true,
        params: true,
        logger: this.logger.debug.bind(this.logger),
      });
    }, AxiosLogger.errorLogger);

    this.api.interceptors.response.use((response) => {
      AxiosLogger.responseLogger(response, {
        prefixText: 'Roborock IoT API',
        dateFormat: 'HH:MM:ss',
        headers: true,
        data: true,
        status: true,
        statusText: true,
        params: true,
        logger: this.logger.debug.bind(this.logger),
      });
      return response;
    }, AxiosLogger.errorLogger);
  }

  public async getHomeWithProducts(homeId: number): Promise<Home | undefined> {
    let homeData = await this.getHome(homeId);
    let homeDataV2: Home | undefined;
    let homeDataV3: Home | undefined;
    if (!homeData) {
      this.logger.error('[getHomeWithProducts Step 1] Failed to retrieve the home data');
      homeDataV2 = await this.getHomev2(homeId);
      homeData = homeDataV2;
    }

    if (!homeData) {
      this.logger.error('[getHomeWithProducts Step 2] Failed to retrieve the home data');
      homeDataV3 = await this.getHomev3(homeId);
      homeData = homeDataV3;
    }

    if (!homeData) {
      this.logger.error('[getHomeWithProducts Step 3] Failed to retrieve the home data');
      return undefined;
    }

    if (homeData.products.some((p) => this.vacuumNeedAPIV3.includes(p.model))) {
      this.logger.debug('Using v3 API for home data retrieval');
      homeDataV3 = homeDataV3 ?? (await this.getHomev3(homeId));
      if (!homeDataV3) {
        throw new Error('Failed to retrieve the home data from v3 API');
      }
      homeData.devices = [...homeData.devices, ...homeDataV3.devices.filter((d) => !homeData.devices.some((x) => x.duid === d.duid))];
      homeData.receivedDevices = [...homeData.receivedDevices, ...homeDataV3.receivedDevices.filter((d) => !homeData.receivedDevices.some((x) => x.duid === d.duid))];
    }

    if (homeData.rooms.length === 0) {
      homeDataV2 = homeDataV2 ?? (await this.getHomev2(homeId));
      if (homeDataV2?.rooms && homeDataV2.rooms.length > 0) {
        homeData.rooms = homeDataV2.rooms;
      } else {
        homeDataV3 = homeDataV3 ?? (await this.getHomev3(homeId));
        if (homeDataV3?.rooms && homeDataV3.rooms.length > 0) {
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
      this.logger.error('[getHome] Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`[getHome] Failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getHomev2(homeId: number): Promise<Home | undefined> {
    try {
      const result = await this.api.get(`v2/user/homes/${homeId}`);
      const apiResponse: ApiResponse<Home> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('[getHomev2] Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`[getHomev2] Failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getHomev3(homeId: number): Promise<Home | undefined> {
    try {
      const result = await this.api.get(`v3/user/homes/${homeId}`); // can be v3 also
      const apiResponse: ApiResponse<Home> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('[getHomev3] Failed to retrieve the home data');
      return undefined;
    } catch (error) {
      this.logger.error(`[getHomev3] Failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }

  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    try {
      const result = await this.api.get(`user/scene/home/${homeId}`);
      const apiResponse: ApiResponse<Scene[]> = result.data;
      if (apiResponse.result) {
        return apiResponse.result;
      }
      this.logger.error('[getScenes] Failed to retrieve scenes');
      return undefined;
    } catch (error) {
      this.logger.error(`[getScenes] Failed: ${error ? debugStringify(error) : 'unknown'}`);
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
      this.logger.error('[startScene] Failed to execute scene');
      return undefined;
    } catch (error) {
      this.logger.error(`[startScene] Failed: ${error ? debugStringify(error) : 'unknown'}`);
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
      this.logger.error('[getCustom] Failed to execute custom request');
      return undefined;
    } catch (error) {
      this.logger.error(`[getCustom] Failed: ${error ? debugStringify(error) : 'unknown'}`);
      return undefined;
    }
  }
}
