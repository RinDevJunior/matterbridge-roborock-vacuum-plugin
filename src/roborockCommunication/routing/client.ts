import { RequestMessage, ResponseMessage } from '../models/index.js';
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

	query<T>(
		duid: string,
		request: RequestMessage,
		parseFn: (msg: ResponseMessage) => T | undefined,
		timeoutMs?: number,
	): Promise<T | undefined>;
}
