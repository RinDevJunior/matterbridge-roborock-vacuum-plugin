import { ResponseMessage } from '../../models/index.js';
import { AbstractMessageListener } from './abstractMessageListener.js';

export interface ResponseBroadcaster {
  readonly name: string;
  register(listener: AbstractMessageListener): void;
  unregister(): void;
  tryResolve(response: ResponseMessage): void;
  onMessage(message: ResponseMessage): void;
}
