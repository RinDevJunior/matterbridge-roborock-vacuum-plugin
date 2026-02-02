import { ResponseMessage } from '../../models/responseMessage.js';

export interface AbstractMessageListener {
  name: string;
  onMessage(message: ResponseMessage): void;
}
