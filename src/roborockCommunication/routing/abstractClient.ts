import { AnsiLogger } from 'matterbridge/logger';
import { ConnectionBroadcaster } from './listeners/connectionBroadcaster.js';
import { MessageContext } from '../models/messageContext.js';
import { ConnectionStateListener } from './listeners/implementation/connectionStateListener.js';
import { RequestMessage } from '../models/requestMessage.js';
import { AbstractConnectionListener } from './listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from './listeners/abstractMessageListener.js';
import { Client } from './client.js';
import { MessageSerializer } from '../protocol/serializers/messageSerializer.js';
import { MessageDeserializer } from '../protocol/deserializers/messageDeserializer.js';
import { PendingResponseTracker } from './services/pendingResponseTracker.js';
import { ResponseBroadcaster } from './listeners/responseBroadcaster.js';

export abstract class AbstractClient implements Client {
  public isInDisconnectingStep = false;
  public retryCount = 0;

  protected readonly connectionBroadcaster = new ConnectionBroadcaster();
  protected readonly serializer: MessageSerializer;
  protected readonly deserializer: MessageDeserializer;
  protected connectionStateListener: ConnectionStateListener | undefined;

  protected abstract clientName: string;

  protected constructor(
    protected readonly logger: AnsiLogger,
    protected readonly context: MessageContext,
    protected readonly responseBroadcaster: ResponseBroadcaster,
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

  protected initializeConnectionStateListener(client: AbstractClient): void {
    this.connectionStateListener = new ConnectionStateListener(this.logger, client, this.clientName);
    this.connectionBroadcaster.register(this.connectionStateListener);
  }

  public registerMessageListener(listener: AbstractMessageListener): void {
    this.responseBroadcaster.register(listener);
  }

  /**
   * Sends a request without waiting for a response (fire-and-forget).
   * Use get() if you need to wait for a response.
   */
  public async send(duid: string, request: RequestMessage): Promise<void> {
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
    this.isInDisconnectingStep = false;
  }

  public disconnect(): Promise<void> {
    if (this.connectionStateListener) {
      this.connectionStateListener.stop();
    }
    this.isInDisconnectingStep = true;
    return Promise.resolve();
  }

  public async get<T>(duid: string, request: RequestMessage): Promise<T | undefined> {
    try {
      const responsePromise = this.responseTracker.waitFor(request, duid);
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
    this.connectionBroadcaster.register(listener);
  }
}
