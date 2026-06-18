import { AnsiLogger } from 'matterbridge/logger';

import { ProtocolVersion } from '../../enums/index.js';
import { ResponseMessage } from '../../models/index.js';
import { MessageContext } from '../../models/messageContext.js';
import { AbstractMessageListener } from './abstractMessageListener.js';
import { B01ResponseBroadcaster } from './b01ResponseBroadcaster.js';
import { ResponseBroadcaster } from './responseBroadcaster.js';
import { V1ResponseBroadcaster } from './v1ResponseBroadcaster.js';

export class ResponseBroadcasterFactory implements ResponseBroadcaster {
	readonly name = 'ResponseBroadcasterFactory';

	private readonly v1Broadcaster: V1ResponseBroadcaster;
	private readonly b01Broadcaster: B01ResponseBroadcaster;

	constructor(
		private readonly context: MessageContext,
		logger: AnsiLogger,
	) {
		this.v1Broadcaster = new V1ResponseBroadcaster(logger);
		this.b01Broadcaster = new B01ResponseBroadcaster(logger);
	}

	public register(listener: AbstractMessageListener): void {
		this.v1Broadcaster.register(listener);
		this.b01Broadcaster.register(listener);
	}

	public deregister(listener: AbstractMessageListener): void {
		this.v1Broadcaster.deregister(listener);
		this.b01Broadcaster.deregister(listener);
	}

	public unregister(): void {
		this.v1Broadcaster.unregister();
		this.b01Broadcaster.unregister();
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		const broadcaster = this.getBroadcasterForResponse(message);
		await broadcaster.onMessage(message);
	}

	private getBroadcasterForResponse(response: ResponseMessage): ResponseBroadcaster {
		const pv = response.header.version ?? this.context.getMQTTProtocolVersion(response.duid);
		if (pv === ProtocolVersion.B01) {
			return this.b01Broadcaster;
		}
		return this.v1Broadcaster;
	}
}
