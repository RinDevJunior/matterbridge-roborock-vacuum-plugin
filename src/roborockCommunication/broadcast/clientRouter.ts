import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from './listener/abstractConnectionListener.js';
import { AbstractMessageListener } from './listener/abstractMessageListener.js';
import { RequestMessage } from './model/requestMessage.js';
import { UserData } from '../Zmodel/userData.js';
import { Client } from './client.js';
import { ChainedConnectionListener } from './listener/implementation/chainedConnectionListener.js';
import { ChainedMessageListener } from './listener/implementation/chainedMessageListener.js';
import { MessageContext } from './model/messageContext.js';
import { LocalNetworkClient } from './client/LocalNetworkClient.js';
import { MQTTClient } from './client/MQTTClient.js';

export class ClientRouter implements Client {
  protected readonly connectionListeners = new ChainedConnectionListener();
  protected readonly messageListeners = new ChainedMessageListener();

  private readonly context: MessageContext;
  private readonly mqttClient: MQTTClient;
  private readonly localClients = new Map<string, LocalNetworkClient>();
  private readonly logger: AnsiLogger;

  public constructor(logger: AnsiLogger, userdata: UserData) {
    this.context = new MessageContext(userdata);
    this.logger = logger;

    this.mqttClient = new MQTTClient(logger, this.context, userdata);
    this.mqttClient.registerConnectionListener(this.connectionListeners);
    this.mqttClient.registerMessageListener(this.messageListeners);
  }

  public registerDevice(duid: string, localKey: string, pv: string): void {
    this.context.registerDevice(duid, localKey, pv);
  }

  public registerClient(duid: string, ip: string): Client {
    const localClient = new LocalNetworkClient(this.logger, this.context, duid, ip);
    localClient.registerConnectionListener(this.connectionListeners);
    localClient.registerMessageListener(this.messageListeners);

    this.localClients.set(duid, localClient);
    return localClient;
  }

  public unregisterClient(duid: string): void {
    this.localClients.delete(duid);
  }

  public registerConnectionListener(listener: AbstractConnectionListener): void {
    this.connectionListeners.register(listener);
  }

  public registerMessageListener(listener: AbstractMessageListener): void {
    this.messageListeners.register(listener);
  }

  public isConnected(): boolean {
    return this.mqttClient.isConnected();
  }

  public connect(): void {
    this.mqttClient.connect();

    this.localClients.forEach((client) => {
      client.connect();
    });
  }

  async disconnect(): Promise<void> {
    await this.mqttClient.disconnect();

    this.localClients.forEach((client) => {
      client.disconnect();
    });
  }

  async send(duid: string, request: RequestMessage): Promise<void> {
    if (request.secure) {
      await this.mqttClient.send(duid, request);
    } else {
      await this.getClient(duid).send(duid, request);
    }
  }

  async get<T>(duid: string, request: RequestMessage): Promise<T> {
    if (request.secure) {
      return await this.mqttClient.get(duid, request);
    } else {
      return await this.getClient(duid).get(duid, request);
    }
  }

  private getClient(duid: string): Client {
    const localClient = this.localClients.get(duid);
    if (localClient === undefined || !localClient.isConnected()) {
      return this.mqttClient;
    } else {
      return localClient;
    }
  }
}
