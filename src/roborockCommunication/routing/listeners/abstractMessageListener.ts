import { ResponseMessage } from '../../models/responseMessage.js';

export interface AbstractMessageListener {
  name: string;
  duid: string;
  onMessage(message: ResponseMessage): void;
}
