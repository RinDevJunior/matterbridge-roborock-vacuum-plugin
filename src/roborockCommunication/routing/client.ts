import { RequestMessage } from '../models/index.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';

export interface Client {
  registerConnectionListener(listener: AbstractConnectionListener): void;

  registerMessageListener(listener: AbstractMessageListener): void;

  isConnected(): boolean;

  isReady(): boolean;

  connect(): void;

  disconnect(): Promise<void>;

  send(duid: string, request: RequestMessage): Promise<void>;

  get<T>(duid: string, request: RequestMessage): Promise<T | undefined>;
}
