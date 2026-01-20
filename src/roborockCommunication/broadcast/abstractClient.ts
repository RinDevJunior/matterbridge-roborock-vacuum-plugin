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
import { ConnectionStateListener } from './listener/implementation/connectionStateListener.js';

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
  private noResponseNeededMethods: string[] = [];

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
   * Sends a request and waits for a response using syncMessageListener.
   * Override this if you need custom send logic, but call super.send for response waiting.
   */
  public async send<T = ResponseMessage>(duid: string, request: RequestMessage): Promise<T | undefined> {
    return new Promise<T>((resolve, reject) => {
      const pv = this.context.getProtocolVersion(duid);
      request.version = request.version ?? pv;
      if (request.method && !this.noResponseNeededMethods.includes(request.method)) {
        this.syncMessageListener.waitFor(request.messageId, request, (response: ResponseMessage) => resolve(response as unknown as T), reject);
      }
      this.sendInternal(duid, request);
    })
      .then((result: T) => result)
      .catch((error: Error) => {
        this.logger.error(error.message);
        return undefined;
      });
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
      if (request.method && !this.noResponseNeededMethods.includes(request.method)) {
        this.syncMessageListener.waitFor(request.messageId, request, (response: ResponseMessage) => resolve(response as unknown as T), reject);
      }
      this.sendInternal(duid, request);
    })
      .then((result: T) => {
        return result;
      })
      .catch((error: Error) => {
        this.logger.error(error.message);
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
