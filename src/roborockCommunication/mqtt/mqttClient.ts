import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import mqtt, { ErrorWithReasonCode, IConnackPacket, ISubscriptionGrant, MqttClient as MqttLibClient } from 'mqtt';

import {
	BACKOFF_MULTIPLIER,
	HEALTH_RESTART_COOLDOWN_MS,
	HEALTH_TIMEOUT_THRESHOLD,
	KEEPALIVE_INTERVAL_MS,
	MAX_BACKOFF_INTERVAL_MS,
	MIN_BACKOFF_INTERVAL_MS,
} from '../../constants/timeouts.js';
import * as CryptoUtils from '../helper/cryptoHelper.js';
import { MessageContext, RequestMessage, Rriot, UserData } from '../models/index.js';
import { AbstractClient } from '../routing/abstractClient.js';
import { ResponseBroadcaster } from '../routing/listeners/responseBroadcaster.js';
import { MqttHealthMonitor } from './mqttHealthMonitor.js';

export class MQTTClient extends AbstractClient {
	protected override clientName = 'MQTTClient';

	private readonly rriot: Rriot;
	private readonly mqttUsername: string;
	private readonly mqttPassword: string;
	private mqttClient: MqttLibClient | undefined = undefined;
	private connected = false;
	private isForceReconnecting = false;
	private consecutiveAuthErrors = 0;
	private authErrorBackoffTimeout: NodeJS.Timeout | undefined = undefined;
	private readonly healthMonitor = new MqttHealthMonitor(HEALTH_TIMEOUT_THRESHOLD, HEALTH_RESTART_COOLDOWN_MS);
	private consecutiveGeneralFailures = 0;
	private generalBackoffMs = MIN_BACKOFF_INTERVAL_MS;
	private generalBackoffTimeout: NodeJS.Timeout | undefined = undefined;

	public constructor(
		logger: AnsiLogger,
		context: MessageContext,
		userdata: UserData,
		responseBroadcaster: ResponseBroadcaster,
	) {
		super(logger, context, responseBroadcaster);
		this.rriot = userdata.rriot;

		this.mqttUsername = CryptoUtils.md5hex(`${userdata.rriot.u}:${userdata.rriot.k}`).substring(2, 10);
		this.mqttPassword = CryptoUtils.md5hex(`${userdata.rriot.s}:${userdata.rriot.k}`).substring(16);

		this.initializeConnectionStateListener(this);
	}

	public override isConnected(): boolean {
		return this.connected;
	}

	public override isReady(): boolean {
		return this.connected && this.mqttClient !== undefined;
	}

	public override connect(): void {
		if (this.mqttClient) {
			return; // Already connected
		}

		super.connect();

		this.mqttClient = mqtt.connect(this.rriot.r.m, {
			clientId: this.mqttUsername,
			username: this.mqttUsername,
			password: this.mqttPassword,
			keepalive: 30,
			log: () => {
				// ...args: unknown[] this.logger.debug(`MQTTClient args: ${debugStringify(args)}`);
			},
		});

		this.mqttClient.on('connect', this.onConnect.bind(this));
		this.mqttClient.on('error', this.onError.bind(this));
		this.mqttClient.on('reconnect', this.onReconnect.bind(this));
		this.mqttClient.on('close', this.onClose.bind(this));
		this.mqttClient.on('disconnect', this.onDisconnect.bind(this));
		this.mqttClient.on('offline', this.onOffline.bind(this));
		this.mqttClient.on('message', this.onMessage.bind(this));
	}

	public override async disconnect(): Promise<void> {
		await super.disconnect();
		if (!this.mqttClient || !this.connected) {
			return Promise.resolve();
		}

		try {
			if (this.authErrorBackoffTimeout) {
				clearTimeout(this.authErrorBackoffTimeout);
				this.authErrorBackoffTimeout = undefined;
			}

			if (this.generalBackoffTimeout) {
				clearTimeout(this.generalBackoffTimeout);
				this.generalBackoffTimeout = undefined;
			}

			this.mqttClient.end();
			this.mqttClient = undefined;
			this.connected = false;
		} catch (error) {
			this.logger.error(
				`[MQTTClient] client failed to disconnect with error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
			);
		}
	}

	protected async sendInternal(duid: string, request: RequestMessage): Promise<void> {
		if (!this.mqttClient || !this.connected) {
			this.logger.error(`${duid}: mqtt is not available, ${debugStringify(request)}`);
			return;
		}
		const mqttRequest = request.toMqttRequest();
		mqttRequest.version = mqttRequest.version ?? this.context.getMQTTProtocolVersion(duid);
		const message = this.serializer.serialize(duid, mqttRequest);
		const topic = `rr/m/i/${this.rriot.u}/${this.mqttUsername}/${duid}`;
		this.logger.debug(`[MQTTClient] sending message to ${topic}: ${debugStringify(mqttRequest)}`);
		this.mqttClient.publish(topic, message.buffer, { qos: 1 });
		this.logger.debug(`[MQTTClient] sent message to ${duid}`);
	}

	public reportQuerySuccess(): void {
		this.healthMonitor.onSuccess();
	}

	public reportQueryTimeout(): void {
		this.healthMonitor.onTimeout();
		if (this.healthMonitor.shouldRestart(Date.now())) {
			this.logger.warn(
				`[MQTTClient] Health monitor: too many consecutive query timeouts (${this.healthMonitor.getConsecutiveTimeouts()})`,
			);
			this.forceReconnect('health monitor: too many consecutive query timeouts');
			this.healthMonitor.recordRestart(Date.now());
		}
	}

	private forceReconnect(reason: string): void {
		if (this.mqttClient) {
			this.logger.debug(`[MQTTClient] Force reconnecting: ${reason}`);
			this.isForceReconnecting = true;
			this.mqttClient.end();
			this.mqttClient.reconnect();
		} else {
			this.logger.info(`[MQTTClient] Force reconnecting (new connection): ${reason}`);
			this.connect();
		}
	}

	private scheduleGeneralBackoffReconnect(reason: string): void {
		this.consecutiveGeneralFailures++;
		const delayMs = this.generalBackoffMs;
		this.generalBackoffMs = Math.min(this.generalBackoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_INTERVAL_MS);

		if (this.generalBackoffTimeout) {
			clearTimeout(this.generalBackoffTimeout);
		}

		this.logger.warn(
			`[MQTTClient] Scheduling general backoff reconnect: ${reason} (delay: ${delayMs}ms, failures: ${this.consecutiveGeneralFailures})`,
		);

		this.terminateConnection();
		this.generalBackoffTimeout = setTimeout(() => {
			this.generalBackoffTimeout = undefined;
			this.connect();
		}, delayMs);
		this.generalBackoffTimeout.unref();
	}

	private async onConnect(result: IConnackPacket): Promise<void> {
		if (!result) {
			this.logger.error('[MQTTClient] onConnect called with no result');
			return;
		}

		const wasForceReconnecting = this.isForceReconnecting;
		this.isForceReconnecting = false;

		this.connected = true;
		this.consecutiveAuthErrors = 0;
		this.consecutiveGeneralFailures = 0;
		this.generalBackoffMs = MIN_BACKOFF_INTERVAL_MS;
		if (this.generalBackoffTimeout) {
			clearTimeout(this.generalBackoffTimeout);
			this.generalBackoffTimeout = undefined;
		}

		this.logger.info(`[MQTTClient] connected to MQTT broker with result: ${debugStringify(result)}`);
		this.subscribeToQueue();

		if (!wasForceReconnecting) {
			await this.connectionBroadcaster.onConnected(`mqtt-${this.mqttUsername}`);
		}
	}

	private subscribeToQueue(): void {
		if (!this.mqttClient || !this.connected) {
			this.logger.error('[MQTTClient] cannot subscribe, client not connected');
			return;
		}

		this.mqttClient.subscribe(`rr/m/o/${this.rriot.u}/${this.mqttUsername}/#`, this.onSubscribe.bind(this));
	}

	private async onSubscribe(err: Error | null, subscription: ISubscriptionGrant[] | undefined): Promise<void> {
		const hasError = err !== null && err !== undefined;
		if (hasError) {
			this.logger.error(`[MQTTClient] Failed to subscribe: ${String(err)}`);
			this.connected = false;

			await this.connectionBroadcaster.onDisconnected(
				`mqtt-${this.mqttUsername}`,
				`Failed to subscribe to the queue: ${String(err)}`,
			);
			return;
		}
		this.logger.info(`[MQTTClient] Connection subscribed: ${subscription ? debugStringify(subscription) : 'unknown'}`);
	}

	private async onDisconnect(): Promise<void> {
		this.connected = false;
		await this.connectionBroadcaster.onDisconnected(`mqtt-${this.mqttUsername}`, 'Disconnected from MQTT broker');
	}

	private async onError(result: Error | ErrorWithReasonCode): Promise<void> {
		// MQTT error code 5 = Connection Refused: Not Authorized (authentication failure)
		const isAuthError = 'code' in result && result.code === 5;
		const errorMessage = isAuthError ? 'Connection refused: Not authorized' : debugStringify(result);

		this.logger.error(`MQTT connection error: ${errorMessage}`);
		await this.connectionBroadcaster.onError(`mqtt-${this.mqttUsername}`, `MQTT connection error: ${errorMessage}`);

		if (isAuthError) {
			this.consecutiveAuthErrors++;
			this.logger.warn(`[MQTTClient] Auth error count: ${this.consecutiveAuthErrors}/5`);

			if (this.consecutiveAuthErrors >= 5) {
				this.logger.error('[MQTTClient] Auth error threshold reached, entering 60-minute backoff');
				this.terminateConnection();

				// Wait 60 minutes then reconnect
				this.authErrorBackoffTimeout = setTimeout(() => {
					this.authErrorBackoffTimeout = undefined;
					this.consecutiveAuthErrors = 0;
					this.logger.info('[MQTTClient] Auth error backoff period ended, attempting reconnection');
					this.connect();
				}, KEEPALIVE_INTERVAL_MS);
				this.authErrorBackoffTimeout.unref();
			}
		} else {
			this.scheduleGeneralBackoffReconnect(`MQTT connection error: ${errorMessage}`);
		}
	}

	private terminateConnection(): void {
		if (this.authErrorBackoffTimeout) {
			clearTimeout(this.authErrorBackoffTimeout);
			this.authErrorBackoffTimeout = undefined;
		}

		if (this.generalBackoffTimeout) {
			clearTimeout(this.generalBackoffTimeout);
			this.generalBackoffTimeout = undefined;
		}

		if (this.mqttClient) {
			this.mqttClient.end(true);
			this.mqttClient = undefined;
		}

		this.connected = false;
	}

	private async onClose(): Promise<void> {
		if (this.connected && !this.isForceReconnecting) {
			await this.connectionBroadcaster.onClose(`mqtt-${this.mqttUsername}`);
			this.scheduleGeneralBackoffReconnect('MQTT connection closed unexpectedly');
		}

		this.connected = false;
	}

	private async onOffline(): Promise<void> {
		this.connected = false;
		await this.connectionBroadcaster.onOffline(`mqtt-${this.mqttUsername}`);
		this.scheduleGeneralBackoffReconnect('MQTT client went offline');
	}

	private onReconnect(): void {
		// Note: 'reconnect' event fires when MQTT library *starts* a reconnection attempt,
		// NOT when it successfully reconnects. The 'connect' event fires on successful reconnection.
		// Do NOT call subscribeToQueue() here - it will be called by onConnect() when successful.
		this.connectionBroadcaster.onReconnect('mqtt-' + this.mqttUsername, 'Attempting to reconnect to MQTT broker');
	}

	private async onMessage(topic: string, message: Buffer): Promise<void> {
		if (!message) {
			// Ignore empty messages
			this.logger.notice(`[MQTTClient] received empty message from topic: ${topic}`);
			return;
		}

		try {
			const duid = topic.split('/').slice(-1)[0];
			const response = this.deserializer.deserialize(duid, message, 'MQTTClient');
			await this.responseBroadcaster.onMessage(response);
		} catch (error) {
			const errMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
			this.logger.error(`[MQTTClient]: unable to process message ${topic}: ${errMsg}`);
		}
	}
}
