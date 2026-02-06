import { AnsiLogger } from 'matterbridge/logger';
import { ChainedConnectionListener } from './listeners/implementation/chainedConnectionListener.js';
import { ChainedMessageListener } from './listeners/implementation/chainedMessageListener.js';
import { MessageContext } from '../models/messageContext.js';
import { ConnectionStateListener } from './listeners/implementation/connectionStateListener.js';
import { RequestMessage } from '../models/requestMessage.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { Client } from './client.js';
import { MessageSerializer } from '../protocol/serializers/messageSerializer.js';
import { MessageDeserializer } from '../protocol/deserializers/messageDeserializer.js';
import { PendingResponseTracker } from './services/pendingResponseTracker.js';

export abstract class AbstractClient implements Client {
  public isInDisconnectingStep = false;
  public retryCount = 0;

  protected readonly connectionListener = new ChainedConnectionListener();
  protected readonly serializer: MessageSerializer;
  protected readonly deserializer: MessageDeserializer;
  protected connectionStateListener: ConnectionStateListener | undefined;

  protected abstract clientName: string;

  protected constructor(
    protected readonly logger: AnsiLogger,
    protected readonly context: MessageContext,
    protected readonly chainedMessageListener: ChainedMessageListener,
    private readonly responseTracker: PendingResponseTracker,
  ) {
    this.serializer = new MessageSerializer(this.context, this.logger);
    this.deserializer = new MessageDeserializer(this.context, this.logger);
  }

  abstract isConnected(): boolean;

  /** Returns true when client is ready to send requests. Override for custom handshake logic. */
  public isReady(): boolean {
    return this.isConnected();
  }

  protected initializeConnectionStateListener() {
    this.connectionStateListener = new ConnectionStateListener(this.logger, this, this.clientName);
    this.connectionListener.register(this.connectionStateListener);
  }

  public registerMessageListener(listener: AbstractMessageListener): void {
    this.chainedMessageListener.register(listener);
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
    try {
      const pv = this.context.getProtocolVersion(duid);
      request.version = request.version ?? pv;

      const responsePromise = this.responseTracker.waitFor(request.messageId, request);
      this.sendInternal(duid, request);

      const response = await responsePromise;
      return response as unknown as T;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
    this.context.registerDevice(duid, localKey, pv, nonce);
  }

  public registerConnectionListener(listener: AbstractConnectionListener): void {
    this.connectionListener.register(listener);
  }
}
