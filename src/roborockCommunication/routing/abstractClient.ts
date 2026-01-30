import { AnsiLogger } from 'matterbridge/logger';
import { ChainedConnectionListener } from './listeners/implementation/chainedConnectionListener.js';
import { ChainedMessageListener } from './listeners/implementation/chainedMessageListener.js';
import { MessageContext } from '../models/messageContext.js';
import { ConnectionStateListener } from './listeners/implementation/connectionStateListener.js';
import { SyncMessageListener } from './listeners/implementation/syncMessageListener.js';
import { RequestMessage } from '../models/requestMessage.js';
import { ResponseMessage } from '../models/responseMessage.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { Client } from './client.js';
import { MessageSerializer } from '../protocol/serializers/messageSerializer.js';
import { MessageDeserializer } from '../protocol/deserializers/messageDeserializer.js';

export abstract class AbstractClient implements Client {
  public isInDisconnectingStep = false;
  public retryCount = 0;

  protected readonly connectionListeners = new ChainedConnectionListener();
  protected readonly messageListeners = new ChainedMessageListener();
  protected readonly serializer: MessageSerializer;
  protected readonly deserializer: MessageDeserializer;
  protected readonly context: MessageContext;
  protected connected = false;
  protected logger: AnsiLogger;
  protected connectionStateListener: ConnectionStateListener | undefined;

  protected abstract clientName: string;

  private readonly syncMessageListener: SyncMessageListener;

  protected constructor(logger: AnsiLogger, context: MessageContext, syncMessageListener?: SyncMessageListener) {
    this.context = context;
    this.serializer = new MessageSerializer(this.context, logger);
    this.deserializer = new MessageDeserializer(this.context, logger);

    this.syncMessageListener = syncMessageListener ?? new SyncMessageListener(logger);
    this.messageListeners.register(this.syncMessageListener);
    this.logger = logger;
  }

  abstract isReady(): boolean;

  protected initializeConnectionStateListener() {
    this.connectionStateListener = new ConnectionStateListener(this.logger, this, this.clientName);
    this.connectionListeners.register(this.connectionStateListener);
  }

  /**
   * Sends a request without waiting for a response (fire-and-forget).
   * Use get() if you need to wait for a response.
   */
  public async send(duid: string, request: RequestMessage): Promise<void> {
    const pv = this.context.getProtocolVersion(duid);
    request.version = request.version ?? pv;
    this.sendInternal(duid, request);
  }

  /**
   * Internal send logic to be implemented by subclasses (e.g., actual network send).
   */
  protected abstract sendInternal(duid: string, request: RequestMessage): void;

  public connect(): void {
    if (this.connectionStateListener) {
      this.connectionStateListener.start();
    }
  }

  public disconnect(): Promise<void> {
    if (this.connectionStateListener) {
      this.connectionStateListener.stop();
    }
    return Promise.resolve();
  }

  public async get<T>(duid: string, request: RequestMessage): Promise<T | undefined> {
    return new Promise<T>((resolve, reject) => {
      const pv = this.context.getProtocolVersion(duid);
      request.version = request.version ?? pv;
      this.syncMessageListener.waitFor(
        request.messageId,
        request,
        (response: ResponseMessage) => {
          resolve(response as unknown as T);
        },
        reject,
      );
      this.sendInternal(duid, request);
    })
      .then((result: T) => {
        return result;
      })
      .catch((error: unknown) => {
        this.logger.error(error instanceof Error ? error.message : String(error));
        return undefined;
      });
  }

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
    this.context.registerDevice(duid, localKey, pv, nonce);
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
