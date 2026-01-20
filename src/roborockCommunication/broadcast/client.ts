import { AbstractConnectionListener, AbstractMessageListener } from './listener/index.js';
import { RequestMessage } from './model/index.js';

export interface Client {
  registerConnectionListener(listener: AbstractConnectionListener): void;

  registerMessageListener(listener: AbstractMessageListener): void;

  isConnected(): boolean;

  connect(): void;

  disconnect(): Promise<void>;

  send(duid: string, request: RequestMessage): Promise<void>;

  get<T>(duid: string, request: RequestMessage): Promise<T | undefined>;
}
