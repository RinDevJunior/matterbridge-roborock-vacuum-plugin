import mqtt, { ErrorWithReasonCode, IConnackPacket, ISubscriptionGrant, MqttClient as MqttLibClient } from 'mqtt';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import * as CryptoUtils from '../helper/cryptoHelper.js';
import { RequestMessage, MessageContext, Rriot, UserData } from '../models/index.js';
import { AbstractClient } from '../routing/abstractClient.js';
import { KEEPALIVE_INTERVAL_MS } from '../../constants/timeouts.js';
import { V1PendingResponseTracker } from '../routing/services/v1PendingResponseTracker.js';
import { V1ResponseBroadcaster } from '../routing/listeners/v1ResponseBroadcaster.js';

export class MQTTClient extends AbstractClient {
  protected override clientName = 'MQTTClient';

  private readonly rriot: Rriot;
  private readonly mqttUsername: string;
  private readonly mqttPassword: string;
  private mqttClient: MqttLibClient | undefined = undefined;
  private keepConnectionAliveInterval: NodeJS.Timeout | undefined = undefined;
  private connected = false;
  private consecutiveAuthErrors = 0;
  private authErrorBackoffTimeout: NodeJS.Timeout | undefined = undefined;

  public constructor(logger: AnsiLogger, context: MessageContext, userdata: UserData, responseBroadcaster: V1ResponseBroadcaster, responseTracker: V1PendingResponseTracker) {
    super(logger, context, responseBroadcaster, responseTracker);
    this.rriot = userdata.rriot;

    this.mqttUsername = CryptoUtils.md5hex(`${String(userdata.rriot.u)}:${String(userdata.rriot.k)}`).substring(2, 10);
    this.mqttPassword = CryptoUtils.md5hex(`${String(userdata.rriot.s)}:${String(userdata.rriot.k)}`).substring(16);

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

    this.keepConnectionAlive();
  }

  public override async disconnect(): Promise<void> {
    await super.disconnect();
    if (!this.mqttClient || !this.connected) {
      return Promise.resolve();
    }

    try {
      if (this.keepConnectionAliveInterval) {
        clearInterval(this.keepConnectionAliveInterval);
        this.keepConnectionAliveInterval = undefined;
      }

      if (this.authErrorBackoffTimeout) {
        clearTimeout(this.authErrorBackoffTimeout);
        this.authErrorBackoffTimeout = undefined;
      }

      this.mqttClient.end();
      this.mqttClient = undefined;
      this.connected = false;
    } catch (error) {
      this.logger.error(`[MQTTClient] client failed to disconnect with error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
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
    this.logger.debug(`[MQTTClient] sending message to ${duid}: ${debugStringify(mqttRequest)}`);
    this.mqttClient.publish(`rr/m/i/${this.rriot.u}/${this.mqttUsername}/${duid}`, message.buffer, { qos: 1 });
    this.logger.debug(`[MQTTClient] sent message to ${duid}`);
  }

  private keepConnectionAlive(): void {
    if (this.keepConnectionAliveInterval) {
      clearInterval(this.keepConnectionAliveInterval);
    }

    this.keepConnectionAliveInterval = setInterval(() => {
      if (this.mqttClient && this.connected) {
        this.logger.debug('[MQTTClient] Connection is active, no action needed');
      } else if (this.mqttClient && !this.connected) {
        this.logger.debug('[MQTTClient] MQTT client exists but not connected, reconnecting');
        this.mqttClient = undefined;
        this.connect();
      } else {
        this.logger.debug('[MQTTClient] MQTT client not initialized, calling connect to establish connection');
        this.connect();
      }
    }, KEEPALIVE_INTERVAL_MS);
    this.keepConnectionAliveInterval.unref();
  }

  private async onConnect(result: IConnackPacket): Promise<void> {
    if (!result) {
      this.logger.error('[MQTTClient] onConnect called with no result');
      return;
    }

    this.connected = true;
    this.consecutiveAuthErrors = 0;
    this.logger.info(`[MQTTClient] connected to MQTT broker with result: ${debugStringify(result)}`);
    await this.connectionBroadcaster.onConnected(`mqtt-${this.mqttUsername}`);
    this.subscribeToQueue();
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

      await this.connectionBroadcaster.onDisconnected(`mqtt-${this.mqttUsername}`, `Failed to subscribe to the queue: ${String(err)}`);
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
    }
  }

  private terminateConnection(): void {
    if (this.keepConnectionAliveInterval) {
      clearInterval(this.keepConnectionAliveInterval);
      this.keepConnectionAliveInterval = undefined;
    }

    if (this.authErrorBackoffTimeout) {
      clearTimeout(this.authErrorBackoffTimeout);
      this.authErrorBackoffTimeout = undefined;
    }

    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = undefined;
    }

    this.connected = false;
  }

  private async onClose(): Promise<void> {
    if (this.connected) {
      await this.connectionBroadcaster.onDisconnected(`mqtt-${this.mqttUsername}`, 'MQTT connection closed');
    }

    this.connected = false;
  }

  private async onOffline(): Promise<void> {
    this.connected = false;
    await this.connectionBroadcaster.onDisconnected('mqtt-' + this.mqttUsername, 'MQTT connection offline');
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
      this.responseBroadcaster.tryResolve(response);
      this.responseBroadcaster.onMessage(response);
    } catch (error) {
      const errMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(`[MQTTClient]: unable to process message ${topic}: ${errMsg}`);
    }
  }
}
