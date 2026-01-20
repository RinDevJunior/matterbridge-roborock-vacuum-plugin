import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener, AbstractMessageListener, ChainedConnectionListener, ChainedMessageListener } from './listener/index.js';
import { MessageContext, RequestMessage } from './model/index.js';
import { UserData } from '../Zmodel/userData.js';
import { Client } from './client.js';
import { LocalNetworkClient, MQTTClient } from './client/index.js';
import { AbstractClient } from './abstractClient.js';

export class ClientRouter implements Client {
  protected readonly connectionListeners = new ChainedConnectionListener();
  protected readonly messageListeners = new ChainedMessageListener();

  private readonly context: MessageContext;
  private readonly localClients = new Map<string, AbstractClient>();
  private readonly logger: AnsiLogger;
  private mqttClient: MQTTClient;

  public constructor(logger: AnsiLogger, userdata: UserData) {
    this.context = new MessageContext(userdata);
    this.logger = logger;

    this.mqttClient = new MQTTClient(logger, this.context, userdata);
    this.mqttClient.registerConnectionListener(this.connectionListeners);
    this.mqttClient.registerMessageListener(this.messageListeners);
  }

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
    this.context.registerDevice(duid, localKey, pv, nonce);
  }

  public updateNonce(duid: string, nonce: number): void {
    this.context.updateNonce(duid, nonce);
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

  public async disconnect(): Promise<void> {
    await this.mqttClient.disconnect();

    this.localClients.forEach((client) => {
      client.disconnect();
    });
  }

  public async send(duid: string, request: RequestMessage): Promise<void> {
    if (request.secure) {
      await this.mqttClient.send(duid, request);
    } else {
      await this.getClient(duid).send(duid, request);
    }
  }

  public async get<T>(duid: string, request: RequestMessage): Promise<T | undefined> {
    if (request.secure) {
      return await this.mqttClient.get(duid, request);
    } else {
      return await this.getClient(duid).get(duid, request);
    }
  }

  private getClient(duid: string): Client {
    const localClient = this.localClients.get(duid);
    if (localClient === undefined || !localClient.isConnected() || !localClient.isReady()) {
      return this.mqttClient;
    } else {
      return localClient;
    }
  }
}
