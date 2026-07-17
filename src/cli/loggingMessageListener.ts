import { AnsiLogger } from 'matterbridge/logger';

import { ResponseMessage } from '../roborockCommunication/models/responseMessage.js';
import { AbstractMessageListener } from '../roborockCommunication/routing/listeners/abstractMessageListener.js';

export class LoggingMessageListener implements AbstractMessageListener {
	readonly name = 'LoggingMessageListener';
	readonly requiresBody = false;

	constructor(
		public readonly duid: string,
		private readonly logger: AnsiLogger,
	) {}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) return;

		const { protocol, seq } = message.header;
		const body = message.body ? JSON.stringify(message.body.data) : '(empty)';
		this.logger.info(`[MQTT] duid=${message.duid} protocol=${protocol} seq=${seq} body=${body}`);
	}
}
