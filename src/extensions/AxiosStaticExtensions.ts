import { AxiosStatic } from 'axios';
import { AnsiLogger } from 'matterbridge/logger';

declare module 'axios' {
  interface AxiosStatic {
    interceptRequestAndResponse(logger: AnsiLogger): this;
  }
}

// Add the method to the actual axios object
import axios from 'axios';

(axios as any).interceptRequestAndResponse = function (logger: AnsiLogger): AxiosStatic {
  this.interceptors.request.use((request: any) => {
    logger.debug('Axios Request:', {
      method: request.method,
      url: request.url,
      data: request.data,
      headers: request.headers,
    });
    return request;
  });

  this.interceptors.response.use((response: any) => {
    logger.debug('Axios Response:', {
      status: response.status,
      data: response.data,
      headers: response.headers,
      url: response.config.url,
    });
    return response;
  });

  return this;
};
