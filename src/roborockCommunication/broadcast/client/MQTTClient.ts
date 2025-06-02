import mqtt, { ErrorWithReasonCode, IConnackPacket, ISubscriptionGrant, MqttClient as MqttLibClient } from 'mqtt';
import { CryptoUtils } from '../../helper/cryptoHelper.js';
import { RequestMessage } from '../model/requestMessage.js';
import { AbstractClient } from '../abstractClient.js';
import { MessageContext } from '../model/messageContext.js';
import { Rriot, UserData } from '../../Zmodel/userData.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';

export class MQTTClient extends AbstractClient {
  private readonly rriot: Rriot;
  private readonly mqttUsername: string;
  private readonly mqttPassword: string;
  private client: MqttLibClient | undefined = undefined;

  public constructor(logger: AnsiLogger, context: MessageContext, userdata: UserData) {
    super(logger, context);
    this.rriot = userdata.rriot;

    this.mqttUsername = CryptoUtils.md5hex(userdata.rriot.u + ':' + userdata.rriot.k).substring(2, 10);
    this.mqttPassword = CryptoUtils.md5hex(userdata.rriot.s + ':' + userdata.rriot.k).substring(16);
  }

  public connect(): void {
    if (this.client) {
      return;
    }

    this.client = mqtt.connect(this.rriot.r.m, {
      clientId: this.mqttUsername,
      username: this.mqttUsername,
      password: this.mqttPassword,
      keepalive: 30,
      log: (...args: any[]) => {
        //this.logger.debug('MQTTClient args:: ' + args[0]);
      },
    });

    this.client.on('connect', this.onConnect.bind(this));
    this.client.on('error', this.onError.bind(this));
    this.client.on('reconnect', this.onReconnect.bind(this));
    this.client.on('close', this.onDisconnect.bind(this));
    this.client.on('disconnect', this.onDisconnect.bind(this));
    this.client.on('offline', this.onDisconnect.bind(this));

    // message events
    this.client.on('message', this.onMessage.bind(this));
  }

  public async disconnect(): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }
    try {
      this.client.end();
    } catch (error) {
      this.logger.error('MQTT client failed to disconnect with error: ' + error);
    }
  }

  public async send(duid: string, request: RequestMessage): Promise<void> {
    if (!this.client || !this.connected) {
      this.logger.error(`${duid}: mqtt is not available, ${debugStringify(request)}`);
      return;
    }

    const mqttRequest = request.toMqttRequest();
    const message = this.serializer.serialize(duid, mqttRequest);
    this.client.publish('rr/m/i/' + this.rriot.u + '/' + this.mqttUsername + '/' + duid, message.buffer, { qos: 1 });
  }

  private async onConnect(result: IConnackPacket) {
    if (!result) {
      return;
    }

    this.connected = true;
    await this.connectionListeners.onConnected();

    this.subscribeToQueue();
  }

  private subscribeToQueue() {
    if (!this.client) {
      return;
    }
    this.client.subscribe('rr/m/o/' + this.rriot.u + '/' + this.mqttUsername + '/#', this.onSubscribe.bind(this));
  }

  private async onSubscribe(err: Error | null, granted: ISubscriptionGrant[] | undefined) {
    if (!err) {
      return;
    }

    this.logger.error('failed to subscribe to the queue: ' + err);
    this.connected = false;

    await this.connectionListeners.onDisconnected();
  }

  private async onDisconnect() {
    await this.connectionListeners.onDisconnected();
  }

  private async onError(result: Error | ErrorWithReasonCode) {
    this.logger.error('MQTT connection error: ' + result);
    this.connected = false;

    await this.connectionListeners.onError(result.toString());
  }

  private onReconnect() {
    this.subscribeToQueue();
  }

  private async onMessage(topic: string, message: Buffer<ArrayBufferLike>) {
    if (!message) {
      //Ignore empty messages
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
