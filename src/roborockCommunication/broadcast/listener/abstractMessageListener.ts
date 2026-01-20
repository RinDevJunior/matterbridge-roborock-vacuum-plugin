import { ResponseMessage } from '../../index.js';

export interface AbstractMessageListener {
  onMessage(message: ResponseMessage): Promise<void>;
}
