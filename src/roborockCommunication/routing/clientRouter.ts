import { AnsiLogger } from 'matterbridge/logger';

import { LocalNetworkClient } from '../local/localClient.js';
import { MessageContext, RequestMessage, UserData } from '../models/index.js';
import { MQTTClient } from '../mqtt/mqttClient.js';
import { AbstractClient } from './abstractClient.js';
import { Client } from './client.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { ConnectionBroadcaster } from './listeners/connectionBroadcaster.js';
import { ResponseBroadcasterFactory } from './listeners/responseBroadcasterFactory.js';

export class ClientRouter implements Client {
	protected readonly connectionBroadcaster: ConnectionBroadcaster;
	protected readonly broadcasterFactory: ResponseBroadcasterFactory;

	private readonly context: MessageContext;
	private readonly localClients = new Map<string, AbstractClient>();
	private mqttClient: MQTTClient;

	public constructor(
		private readonly logger: AnsiLogger,
		userdata: UserData,
	) {
		this.context = new MessageContext(userdata);

		this.broadcasterFactory = new ResponseBroadcasterFactory(this.context, this.logger);
		this.mqttClient = new MQTTClient(logger, this.context, userdata, this.broadcasterFactory, this.broadcasterFactory);
		this.connectionBroadcaster = new ConnectionBroadcaster(this.logger);
		this.mqttClient.registerConnectionListener(this.connectionBroadcaster);
	}

	public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
		this.context.registerDevice(duid, localKey, pv, nonce);
	}

	public updateNonce(duid: string, nonce: number): void {
		this.context.updateNonce(duid, nonce);
	}

	public registerClient(duid: string, ip: string): Client {
		const localClient = new LocalNetworkClient(
			this.logger,
			this.context,
			duid,
			ip,
			this.broadcasterFactory,
			this.broadcasterFactory,
		);
		localClient.registerConnectionListener(this.connectionBroadcaster);

		this.localClients.set(duid, localClient);
		return localClient;
	}

	public unregisterClient(duid: string): void {
		this.localClients.delete(duid);
	}

	public registerConnectionListener(listener: AbstractConnectionListener): void {
		this.connectionBroadcaster.register(listener);
	}

	public registerMessageListener(listener: AbstractMessageListener): void {
		this.broadcasterFactory.register(listener);
	}

	public isConnected(): boolean {
		return this.mqttClient.isConnected();
	}

	public isReady(): boolean {
		return this.mqttClient.isReady();
	}

	public connect(): void {
		this.mqttClient.connect();

		this.localClients.forEach((client) => {
			client.connect();
		});
	}

	public async disconnect(): Promise<void> {
		await this.mqttClient.disconnect();
		this.connectionBroadcaster.unregister();
		this.broadcasterFactory.unregister();
		this.context.unregisterAllDevices();

		for (const client of this.localClients.values()) {
			await client.disconnect();
		}
	}

	public async send(duid: string, request: RequestMessage): Promise<void> {
		if (request.secure) {
			await this.mqttClient.send(duid, request);
		} else {
			await this.getLocalClient(duid).send(duid, request);
		}
	}

	public async get<T>(duid: string, request: RequestMessage): Promise<T | undefined> {
		if (request.secure) {
			return await this.mqttClient.get(duid, request);
		} else {
			return await this.getLocalClient(duid).get(duid, request);
		}
	}

	private getLocalClient(duid: string): Client {
		const localClient = this.localClients.get(duid);
		if (localClient === undefined) {
			return this.mqttClient;
		}
		if (localClient instanceof LocalNetworkClient && localClient.isReconnecting()) {
			this.logger.notice(`[ClientRouter] Local client for ${duid} is reconnecting, falling back to MQTT`);
			return this.mqttClient;
		}
		if (!localClient.isReady()) {
			return this.mqttClient;
		}
		return localClient;
	}
}
