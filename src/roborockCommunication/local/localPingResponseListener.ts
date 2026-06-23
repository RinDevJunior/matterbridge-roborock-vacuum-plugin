import { AnsiLogger } from 'matterbridge/logger';

import { Protocol, ResponseMessage } from '../models/index.js';
import { AbstractMessageListener } from '../routing/listeners/abstractMessageListener.js';

export class LocalPingResponseListener implements AbstractMessageListener {
	readonly name = 'LocalPingResponseListener';
	readonly requiresBody = false;
	private timer?: NodeJS.Timeout;

	public lastPingResponse: number;

	constructor(
		public readonly duid: string,
		private logger: AnsiLogger,
	) {
		this.lastPingResponse = Date.now();
	}

	public resetLastPingResponse() {
		this.lastPingResponse = Date.now();
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) {
			this.logger.debug(
				`[LocalPingResponseListener]: Message DUID ${message.duid} does not match listener DUID ${this.duid}`,
			);
			return;
		}

		if (message.isForProtocol(Protocol.ping_response)) {
			this.logger.debug(
				`[${this.name}] Received ping response message for ${this.duid}, the local communication is healthy.`,
			);

			this.lastPingResponse = Date.now();

			// cleanup the timer
			if (this.timer) {
				clearTimeout(this.timer);
				this.timer.unref();
			}
		}
	}
}
