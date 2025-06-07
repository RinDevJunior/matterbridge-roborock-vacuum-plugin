import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ApiResponse } from '../Zmodel/apiResponse.js';
import { Home } from '../Zmodel/home.js';
import { UserData } from '../Zmodel/userData.js';
import { Scene } from '../Zmodel/scene.js';

export class RoborockIoTApi {
  logger: AnsiLogger;
  private readonly api: AxiosInstance;

  constructor(userdata: UserData, logger: AnsiLogger) {
    this.logger = logger;

    this.api = axios.create({ baseURL: userdata.rriot.r.a });
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

  public async getHome(homeId: number): Promise<Home | undefined> {
    const result = await this.api.get(`user/homes/${homeId}`);

    const apiResponse: ApiResponse<Home> = result.data;
    if (apiResponse.result) {
      return apiResponse.result;
    } else {
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    }
  }

  public async getHomev2(homeId: number): Promise<Home | undefined> {
    const result = await this.api.get('v2/user/homes/' + homeId); //can be v3 also

    const apiResponse: ApiResponse<Home> = result.data;
    if (apiResponse.result) {
      return apiResponse.result;
    } else {
      this.logger.error('Failed to retrieve the home data');
      return undefined;
    }
  }

  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    const result = await this.api.get('user/scene/home/' + homeId);

    const apiResponse: ApiResponse<Scene[]> = result.data;
    if (apiResponse.result) {
      return apiResponse.result;
    } else {
      this.logger.error('Failed to retrieve scene');
      return undefined;
    }
  }

  public async startScene(sceneId: number): Promise<any> {
    const result = await this.api.post(`user/scene/${sceneId}/execute`);
    const apiResponse: ApiResponse<any> = result.data;

    if (apiResponse.result) {
      return apiResponse.result;
    } else {
      this.logger.error('Failed to execute scene');
      return undefined;
    }
  }
}
