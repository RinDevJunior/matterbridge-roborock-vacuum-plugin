import mqtt, { ErrorWithReasonCode, IConnackPacket, ISubscriptionGrant, MqttClient as MqttLibClient } from 'mqtt';
import * as CryptoUtils from '../../helper/cryptoHelper.js';
import { RequestMessage } from '../model/requestMessage.js';
import { AbstractClient } from '../abstractClient.js';
import { MessageContext } from '../model/messageContext.js';
import { Rriot, UserData } from '../../Zmodel/userData.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';

export class MQTTClient extends AbstractClient {
  protected override clientName = 'MQTTClient';
  protected override shouldReconnect = false;
  protected override changeToSecureConnection = (duid: string) => {
    void 0;
  };

  private readonly rriot: Rriot;
  private readonly mqttUsername: string;
  private readonly mqttPassword: string;
  private mqttClient: MqttLibClient | undefined = undefined;
  private keepConnectionAliveInterval: NodeJS.Timeout | undefined = undefined;

  public constructor(logger: AnsiLogger, context: MessageContext, userdata: UserData) {
    super(logger, context);
    this.rriot = userdata.rriot;

    this.mqttUsername = CryptoUtils.md5hex(userdata.rriot.u + ':' + userdata.rriot.k).substring(2, 10);
    this.mqttPassword = CryptoUtils.md5hex(userdata.rriot.s + ':' + userdata.rriot.k).substring(16);

    this.initializeConnectionStateListener();
  }

  public connect(): void {
    if (this.mqttClient) {
      return; // Already connected
    }

    this.mqttClient = mqtt.connect(this.rriot.r.m, {
      clientId: this.mqttUsername,
      username: this.mqttUsername,
      password: this.mqttPassword,
      keepalive: 30,
      log: (...args: unknown[]) => {
        this.logger.debug(`MQTTClient args: ${debugStringify(args)}`);
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

  public async disconnect(): Promise<void> {
    if (!this.mqttClient || !this.connected) {
      return;
    }
    try {
      this.isInDisconnectingStep = true;
      this.mqttClient.end();
    } catch (error) {
      this.logger.error('MQTT client failed to disconnect with error: ' + error);
    }
  }

  public async send(duid: string, request: RequestMessage): Promise<void> {
    if (!this.mqttClient || !this.connected) {
      this.logger.error(`${duid}: mqtt is not available, ${debugStringify(request)}`);
      return;
    }

    const mqttRequest = request.toMqttRequest();
    const message = this.serializer.serialize(duid, mqttRequest);
    this.logger.debug(`MQTTClient sending message to ${duid}: ${debugStringify(mqttRequest)}`);
    this.mqttClient.publish(`rr/m/i/${this.rriot.u}/${this.mqttUsername}/${duid}`, message.buffer, { qos: 1 });
    this.logger.debug(`MQTTClient published message to topic: rr/m/i/${this.rriot.u}/${this.mqttUsername}/${duid}`);
  }

  private keepConnectionAlive(): void {
    if (this.keepConnectionAliveInterval) {
      clearTimeout(this.keepConnectionAliveInterval);
      this.keepConnectionAliveInterval.unref();
    }

    this.keepConnectionAliveInterval = setInterval(
      () => {
        if (this.mqttClient) {
          this.mqttClient.end();
          this.mqttClient.reconnect();
        } else {
          this.connect();
        }
      },
      30 * 60 * 1000,
    );
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
      return;
    }

    this.mqttClient.subscribe('rr/m/o/' + this.rriot.u + '/' + this.mqttUsername + '/#', this.onSubscribe.bind(this));
  }

  private async onSubscribe(err: Error | null, granted: ISubscriptionGrant[] | undefined): Promise<void> {
    if (!err) {
      this.logger.info('onSubscribe: ' + JSON.stringify(granted));
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
    this.connected = false;

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
      this.logger.notice('MQTTClient received empty message from topic: ' + topic);
      return;
    }

    try {
      const duid = topic.split('/').slice(-1)[0];
      const response = this.deserializer.deserialize(duid, message);
      await this.messageListeners.onMessage(response);
    } catch (error) {
      this.logger.error('MQTTClient: unable to process message with error: ' + topic + ': ' + error);
    }
  }
}
