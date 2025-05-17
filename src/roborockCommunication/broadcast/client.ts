import { AbstractConnectionListener } from './listener/abstractConnectionListener.js';
import { AbstractMessageListener } from './listener/abstractMessageListener.js';
import { RequestMessage } from './model/requestMessage.js';

export default interface Client {
  registerConnectionListener(listener: AbstractConnectionListener): void;

  registerMessageListener(listener: AbstractMessageListener): void;

  isConnected(): boolean;

  connect(): void;

  disconnect(): Promise<void>;

  send(duid: string, request: RequestMessage): Promise<void>;

  get<T>(duid: string, request: RequestMessage): Promise<T>;
}
