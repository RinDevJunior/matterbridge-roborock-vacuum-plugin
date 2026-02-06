import { AnsiLogger } from 'matterbridge/logger';
import { AbstractClient } from './abstractClient.js';
import { MessageContext, RequestMessage, UserData } from '../models/index.js';
import { LocalNetworkClient } from '../local/localClient.js';
import { MQTTClient } from '../mqtt/mqttClient.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { ChainedConnectionListener } from './listeners/implementation/chainedConnectionListener.js';
import { Client } from './client.js';
import { PendingResponseTracker } from './services/pendingResponseTracker.js';
import { ResponseBroadcaster } from './listeners/responseBroadcaster.js';

export class ClientRouter implements Client {
  protected readonly connectionListener = new ChainedConnectionListener();
  protected readonly responseBroadcaster: ResponseBroadcaster;

  private readonly context: MessageContext;
  private readonly localClients = new Map<string, AbstractClient>();
  private readonly logger: AnsiLogger;
  private mqttClient: MQTTClient;
  private readonly responseTracker: PendingResponseTracker;

  public constructor(logger: AnsiLogger, userdata: UserData) {
    this.context = new MessageContext(userdata);
    this.logger = logger;

    this.responseTracker = new PendingResponseTracker(this.logger);
    this.responseBroadcaster = new ResponseBroadcaster(this.responseTracker, this.logger);
    this.mqttClient = new MQTTClient(logger, this.context, userdata, this.responseBroadcaster, this.responseTracker);
    this.mqttClient.registerConnectionListener(this.connectionListener);
  }

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
    this.context.registerDevice(duid, localKey, pv, nonce);
  }

  public updateNonce(duid: string, nonce: number): void {
    this.context.updateNonce(duid, nonce);
  }

  public registerClient(duid: string, ip: string): Client {
    const localClient = new LocalNetworkClient(this.logger, this.context, duid, ip, this.responseBroadcaster, this.responseTracker);
    localClient.registerConnectionListener(this.connectionListener);

    this.localClients.set(duid, localClient);
    return localClient;
  }

  public unregisterClient(duid: string): void {
    this.localClients.delete(duid);
  }

  public registerConnectionListener(listener: AbstractConnectionListener): void {
    this.connectionListener.register(listener);
  }

  public registerMessageListener(listener: AbstractMessageListener): void {
    this.responseBroadcaster.register(listener);
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
    this.connectionListener.unregister();
    this.responseBroadcaster.unregister();
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
    if (localClient === undefined || !localClient.isReady()) {
      return this.mqttClient;
    } else {
      return localClient;
    }
  }
}
