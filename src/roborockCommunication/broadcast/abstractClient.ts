import { AnsiLogger } from 'matterbridge/logger';
import { MessageDeserializer } from '../helper/messageDeserializer.js';
import { MessageSerializer } from '../helper/messageSerializer.js';
import { AbstractConnectionListener } from './listener/abstractConnectionListener.js';
import { AbstractMessageListener } from './listener/abstractMessageListener.js';
import { RequestMessage } from './model/requestMessage.js';
import { Client } from './client.js';
import { MessageContext } from './model/messageContext.js';
import { ChainedConnectionListener } from './listener/implementation/chainedConnectionListener.js';
import { ChainedMessageListener } from './listener/implementation/chainedMessageListener.js';
import { SyncMessageListener } from './listener/implementation/syncMessageListener.js';
import { ResponseMessage } from '../index.js';

export abstract class AbstractClient implements Client {
  protected readonly connectionListeners = new ChainedConnectionListener();
  protected readonly messageListeners = new ChainedMessageListener();

  protected connected = false;

  private readonly context: MessageContext;
  protected readonly serializer: MessageSerializer;
  protected readonly deserializer: MessageDeserializer;
  private readonly syncMessageListener: SyncMessageListener;
  protected logger: AnsiLogger;

  protected constructor(logger: AnsiLogger, context: MessageContext) {
    this.context = context;
    this.serializer = new MessageSerializer(this.context, logger);
    this.deserializer = new MessageDeserializer(this.context, logger);

    this.syncMessageListener = new SyncMessageListener(logger);
    this.messageListeners.register(this.syncMessageListener);
    this.logger = logger;
  }

  abstract connect(): void;
  abstract disconnect(): Promise<void>;
  abstract send(duid: string, request: RequestMessage): Promise<void>;

  public async get<T>(duid: string, request: RequestMessage): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.syncMessageListener.waitFor(request.messageId, (response: ResponseMessage) => resolve(response as unknown as T), reject);
      this.send(duid, request);
    });
  }

  public registerDevice(duid: string, localKey: string, pv: string): void {
    this.context.registerDevice(duid, localKey, pv);
  }

  public registerConnectionListener(listener: AbstractConnectionListener): void {
    this.connectionListeners.register(listener);
  }

  public registerMessageListener(listener: AbstractMessageListener): void {
    this.messageListeners.register(listener);
  }

  public isConnected() {
    return this.connected;
  }
}
