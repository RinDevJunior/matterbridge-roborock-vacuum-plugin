import { ResponseMessage } from '../model/responseMessage.js';

export interface AbstractMessageListener {
  onMessage(message: ResponseMessage): Promise<void>;
}
