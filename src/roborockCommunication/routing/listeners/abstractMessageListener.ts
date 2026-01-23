import { ResponseMessage } from '../../models/responseMessage.js';

export interface AbstractMessageListener {
  onMessage(message: ResponseMessage): Promise<void>;
}
