import { AnsiLogger } from 'matterbridge/logger';

import { ResponseMessage } from '../../models/index.js';
import { AbstractMessageListener } from './abstractMessageListener.js';
import { ResponseBroadcaster } from './responseBroadcaster.js';

export class B01ResponseBroadcaster implements ResponseBroadcaster {
	readonly name = 'B01ResponseBroadcaster';

	private listeners: AbstractMessageListener[] = [];

	constructor(private readonly logger: AnsiLogger) {}

	public register(listener: AbstractMessageListener): void {
		this.listeners.push(listener);
	}

	public deregister(listener: AbstractMessageListener): void {
		this.listeners = this.listeners.filter((l) => l !== listener);
	}

	public unregister(): void {
		this.listeners = [];
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		const matchedListeners = this.listeners.filter((x) => x.duid === message.duid);
		if (matchedListeners.length === 0) {
			this.logger.warn(`[B01ResponseBroadcaster] No listener configurated for ${message.duid}`);
			return;
		}

		this.logger.debug(`[B01ResponseBroadcaster] Dispatching message to ${matchedListeners.length} listeners.`);
		for (const listener of matchedListeners) {
			if (listener.requiresBody && message.body === undefined) continue;
			try {
				this.logger.debug(`[B01ResponseBroadcaster] Invoking listener: ${listener.name}`);
				await listener.onMessage(message);
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				this.logger.error(`[B01ResponseBroadcaster] Error in listener: ${errMsg}`);
			}
		}
	}
}
