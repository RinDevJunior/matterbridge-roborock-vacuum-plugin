import { ResponseMessage } from '../../models/index.js';
import { AbstractMessageListener } from './abstractMessageListener.js';

export interface ResponseBroadcaster {
	readonly name: string;
	register(listener: AbstractMessageListener): void;
	deregister(listener: AbstractMessageListener): void;
	unregister(): void;
	onMessage(message: ResponseMessage): Promise<void>;
}
