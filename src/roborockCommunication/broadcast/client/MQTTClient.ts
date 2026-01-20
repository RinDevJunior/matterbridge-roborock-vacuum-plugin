import mqtt, { ErrorWithReasonCode, IConnackPacket, ISubscriptionGrant, MqttClient as MqttLibClient } from 'mqtt';
import * as CryptoUtils from '../../helper/cryptoHelper.js';
import { SyncMessageListener, Rriot, UserData, RequestMessage, MessageContext } from '@/roborockCommunication/index.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { KEEPALIVE_INTERVAL_MS } from '@/constants/index.js';
import { AbstractClient } from '../abstractClient.js';

export class MQTTClient extends AbstractClient {
  protected override clientName = 'MQTTClient';

  private readonly rriot: Rriot;
  private readonly mqttUsername: string;
  private readonly mqttPassword: string;
  private mqttClient: MqttLibClient | undefined = undefined;
  private keepConnectionAliveInterval: NodeJS.Timeout | undefined = undefined;

  public constructor(logger: AnsiLogger, context: MessageContext, userdata: UserData, syncMessageListener?: SyncMessageListener) {
    super(logger, context, syncMessageListener);
    this.rriot = userdata.rriot;

    this.mqttUsername = CryptoUtils.md5hex(userdata.rriot.u + ':' + userdata.rriot.k).substring(2, 10);
    this.mqttPassword = CryptoUtils.md5hex(userdata.rriot.s + ':' + userdata.rriot.k).substring(16);

    this.initializeConnectionStateListener();
  }

  public override isReady(): boolean {
    return this.mqttClient !== undefined && this.connected;
  }

  public override isConnected(): boolean {
    return this.connected;
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
    if (!this.mqttClient || !this.connected) {
      return Promise.resolve();
    }
    try {
      await super.disconnect();
      this.mqttClient.end();
      this.mqttClient = undefined;
      this.connected = false;
    } catch (error) {
      this.logger.error('[MQTTClient] client failed to disconnect with error: ' + error);
    }
  }

  protected async sendInternal(duid: string, request: RequestMessage): Promise<void> {
    if (!this.mqttClient || !this.connected) {
      this.logger.error(`${duid}: mqtt is not available, ${debugStringify(request)}`);
      return;
    }
    const mqttRequest = request.toMqttRequest();
    const message = this.serializer.serialize(duid, mqttRequest);
    this.logger.debug(`[MQTTClient] sending message to ${duid}: ${debugStringify(mqttRequest)}`);
    this.mqttClient.publish(`rr/m/i/${this.rriot.u}/${this.mqttUsername}/${duid}`, message.buffer, { qos: 1 });
    this.logger.debug(`[MQTTClient] sent message to ${duid}`);
  }

  private keepConnectionAlive(): void {
    if (this.keepConnectionAliveInterval) {
      clearTimeout(this.keepConnectionAliveInterval);
      this.keepConnectionAliveInterval.unref();
    }

    this.keepConnectionAliveInterval = setInterval(() => {
      if (this.mqttClient) {
        this.mqttClient.end();
        this.mqttClient.reconnect();
      } else {
        this.connect();
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private async onConnect(result: IConnackPacket): Promise<void> {
    if (!result) {
      return;
    }

    this.connected = true;
    await this.connectionListeners.onConnected('mqtt-' + this.mqttUsername);
    this.subscribeToQueue();
  }

  private subscribeToQueue(): void {
    if (!this.mqttClient || !this.connected) {
      this.logger.error('[MQTTClient] cannot subscribe, client not connected');
      return;
    }

    this.mqttClient.subscribe('rr/m/o/' + this.rriot.u + '/' + this.mqttUsername + '/#', this.onSubscribe.bind(this));
  }

  private async onSubscribe(err: Error | null, subscription: ISubscriptionGrant[] | undefined): Promise<void> {
    if (!err) {
      this.logger.info('onSubscribe: ' + JSON.stringify(subscription));
      return;
    }

    this.logger.error('failed to subscribe: ' + err);
    this.connected = false;

    await this.connectionListeners.onDisconnected('mqtt-' + this.mqttUsername, 'Failed to subscribe to the queue: ' + err.toString());
  }

  private async onDisconnect(): Promise<void> {
    this.connected = false;
    await this.connectionListeners.onDisconnected('mqtt-' + this.mqttUsername, 'Disconnected from MQTT broker');
  }

  private async onError(result: Error | ErrorWithReasonCode): Promise<void> {
    this.logger.error('MQTT connection error: ' + result);
    await this.connectionListeners.onError('mqtt-' + this.mqttUsername, result.toString());
  }

  private async onClose(): Promise<void> {
    if (this.connected) {
      await this.connectionListeners.onDisconnected('mqtt-' + this.mqttUsername, 'MQTT connection closed');
    }

    this.connected = false;
  }

  private async onOffline(): Promise<void> {
    this.connected = false;
    await this.connectionListeners.onDisconnected('mqtt-' + this.mqttUsername, 'MQTT connection offline');
  }

  private onReconnect(): void {
    this.subscribeToQueue();
    this.connectionListeners.onReconnect('mqtt-' + this.mqttUsername, 'Reconnected to MQTT broker');
  }

  private async onMessage(topic: string, message: Buffer<ArrayBufferLike>): Promise<void> {
    if (!message) {
      // Ignore empty messages
      this.logger.notice('[MQTTClient] received empty message from topic: ' + topic);
      return;
    }

    try {
      const duid = topic.split('/').slice(-1)[0];
      const response = this.deserializer.deserialize(duid, message, 'MQTTClient');
      await this.messageListeners.onMessage(response);
    } catch (error) {
      const errMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(`[MQTTClient]: unable to process message ${topic}: ${errMsg}`);
    }
  }
}
