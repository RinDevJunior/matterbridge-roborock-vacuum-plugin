import { AnsiLogger } from 'matterbridge/logger';

import { MessageContext } from '../models/messageContext.js';
import { RequestMessage } from '../models/requestMessage.js';
import { ResponseMessage } from '../models/responseMessage.js';
import { MessageDeserializer } from '../protocol/deserializers/messageDeserializer.js';
import { MessageSerializer } from '../protocol/serializers/messageSerializer.js';
import { Client } from './client.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { ConnectionBroadcaster } from './listeners/connectionBroadcaster.js';
import { ConnectionStateListener } from './listeners/implementation/connectionStateListener.js';
import { OneShotResponseListener } from './listeners/oneShotResponseListener.js';
import { ResponseBroadcaster } from './listeners/responseBroadcaster.js';

export abstract class AbstractClient implements Client {
	public isInDisconnectingStep = false;
	public retryCount = 0;

	protected readonly connectionBroadcaster: ConnectionBroadcaster;
	protected readonly serializer: MessageSerializer;
	protected readonly deserializer: MessageDeserializer;
	protected connectionStateListener: ConnectionStateListener | undefined;

	protected abstract clientName: string;

	protected constructor(
		protected readonly logger: AnsiLogger,
		protected readonly context: MessageContext,
		protected readonly responseBroadcaster: ResponseBroadcaster,
	) {
		this.serializer = new MessageSerializer(this.context, this.logger);
		this.deserializer = new MessageDeserializer(this.context, this.logger);
		this.connectionBroadcaster = new ConnectionBroadcaster(this.logger);
	}

	abstract isConnected(): boolean;

	public isReady(): boolean {
		return this.isConnected();
	}

	protected initializeConnectionStateListener(client: AbstractClient): void {
		this.connectionStateListener = new ConnectionStateListener(this.logger, client, this.clientName);
		this.connectionBroadcaster.register(this.connectionStateListener);
	}

	public registerMessageListener(listener: AbstractMessageListener): void {
		this.responseBroadcaster.register(listener);
	}

	public async send(duid: string, request: RequestMessage): Promise<void> {
		this.sendInternal(duid, request);
	}

	protected abstract sendInternal(duid: string, request: RequestMessage): void;

	public connect(): void {
		if (this.connectionStateListener) {
			this.connectionStateListener.start();
		}
		this.isInDisconnectingStep = false;
	}

	public disconnect(): Promise<void> {
		if (this.connectionStateListener) {
			this.connectionStateListener.stop();
		}
		this.isInDisconnectingStep = true;
		return Promise.resolve();
	}

	public async query<T>(
		duid: string,
		request: RequestMessage,
		parseFn: (msg: ResponseMessage) => T | undefined,
		timeoutMs?: number,
	): Promise<T | undefined> {
		const listener = new OneShotResponseListener<T>(duid, parseFn, timeoutMs);
		this.responseBroadcaster.register(listener);
		try {
			this.sendInternal(duid, request);
			return await listener.waitFor();
		} catch (error) {
			this.logger.error(error instanceof Error ? error.message : String(error));
			return undefined;
		} finally {
			this.responseBroadcaster.deregister(listener);
		}
	}

	public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
		this.context.registerDevice(duid, localKey, pv, nonce);
	}

	public registerConnectionListener(listener: AbstractConnectionListener): void {
		this.connectionBroadcaster.register(listener);
	}
}
