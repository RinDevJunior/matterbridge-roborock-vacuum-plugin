import { Socket } from 'node:net';
import { clearInterval } from 'node:timers';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Protocol, ResponseMessage, MessageContext, RequestMessage } from '../models/index.js';
import { ProtocolVersion } from '../enums/index.js';
import { AbstractClient } from '../routing/abstractClient.js';
import { ChunkBuffer } from '../helper/chunkBuffer.js';
import { Sequence } from '../helper/sequence.js';
import { PendingResponseTracker } from '../routing/services/pendingResponseTracker.js';
import { ResponseBroadcaster } from '../routing/listeners/responseBroadcaster.js';
import { HelloResponseListener } from '../routing/listeners/implementation/helloResponseListener.js';
import { LocalPingResponseListener } from './localPingResponseListener.js';

export class LocalNetworkClient extends AbstractClient {
  protected override clientName = 'LocalNetworkClient';

  private socket: Socket | undefined = undefined;
  private buffer: ChunkBuffer = new ChunkBuffer();
  private messageIdSeq: Sequence;
  private checkConnectionInterval: NodeJS.Timeout | undefined;
  private helloResponseListener: HelloResponseListener;
  private pingResponseListener: LocalPingResponseListener;
  private connected = false;

  constructor(
    logger: AnsiLogger,
    context: MessageContext,
    private readonly duid: string,
    private readonly ip: string,
    responseBroadcaster: ResponseBroadcaster,
    responseTracker: PendingResponseTracker,
  ) {
    super(logger, context, responseBroadcaster, responseTracker);
    this.messageIdSeq = new Sequence(100000, 999999);

    this.helloResponseListener = new HelloResponseListener(this.duid, logger);
    this.pingResponseListener = new LocalPingResponseListener(this.duid, logger);
    this.responseBroadcaster.register(this.helloResponseListener);
    this.responseBroadcaster.register(this.pingResponseListener);
  }

  public override isReady(): boolean {
    return this.connected;
  }

  public override isConnected(): boolean {
    return !!this.socket && this.socket.readyState === 'open' && !this.socket.destroyed;
  }

  public override connect(): void {
    if (this.socket) {
      return; // Already connected
    }

    super.connect();
    this.buffer.reset();
    this.socket = new Socket();

    // Socket event listeners
    this.socket.on('close', this.safeHandler(this.onDisconnect));
    this.socket.on('end', this.safeHandler(this.onEnd));
    this.socket.on('error', this.safeHandler(this.onError));
    this.socket.on('connect', this.safeHandler(this.onConnect));
    this.socket.on('timeout', this.safeHandler(this.onTimeout));

    // Data event listener
    this.socket.on('data', this.safeHandler(this.onMessage));
    this.socket.setTimeout(15000);
    this.socket.connect(58867, this.ip);
  }

  public override async disconnect(): Promise<void> {
    if (!this.socket) {
      return Promise.resolve();
    }

    await super.disconnect();

    if (this.checkConnectionInterval) {
      clearInterval(this.checkConnectionInterval);
      this.checkConnectionInterval = undefined;
    }

    this.socket.destroy();
    this.socket = undefined;
  }

  protected async sendInternal(duid: string, request: RequestMessage): Promise<void> {
    if (!this.socket || !this.isConnected()) {
      this.logger.error(`${duid}: socket is not online, , ${debugStringify(request)}`);
      return;
    }

    if (!request.isForProtocol(Protocol.hello_request) && !this.connected) {
      this.logger.error(`${duid}: socket is not connected, cannot send request, ${debugStringify(request)}`);
      return;
    }

    const protocolVersion = request.version ?? this.context.getLocalProtocolVersion(duid);
    const localRequest = request.toLocalRequest(protocolVersion);
    const message = this.serializer.serialize(duid, localRequest);

    this.logger.debug(
      `[LocalNetworkClient] sending message ${message.messageId}, protocol version: ${localRequest.version}, protocol:${Protocol[localRequest.protocol]}, method:${localRequest.method}, secure:${request.secure} to ${duid}`,
    );
    this.socket.write(this.wrapWithLengthData(message.buffer));
    this.logger.debug(`[LocalNetworkClient] sent message ${message.messageId} to ${duid}`);
  }

  private async onConnect(): Promise<void> {
    this.logger.debug(`[LocalNetworkClient]: ${this.duid} connected to ${this.ip}`);
    this.logger.debug(`[LocalNetworkClient]: ${this.duid} socket writable: ${this.socket?.writable}, readable: ${this.socket?.readable}`);
    await this.trySendHelloRequest();
  }

  private async onDisconnect(hadError: boolean): Promise<void> {
    this.logger.info(`[LocalNetworkClient]: ${this.duid} socket disconnected. Had error: ${hadError}`);

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    if (this.checkConnectionInterval) {
      clearInterval(this.checkConnectionInterval);
      this.checkConnectionInterval = undefined;
    }

    await this.connectionBroadcaster.onDisconnected(this.duid, 'Socket disconnected. Had error: ' + hadError);
    this.connected = false;
  }

  private async onError(error: Error): Promise<void> {
    this.logger.error(` [LocalNetworkClient]: Socket error for ${this.duid}: ${error.message}`);

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }

    await this.connectionBroadcaster.onDisconnected(this.duid, `Socket error: ${error.message}`);
    this.connected = false;
  }

  private async onTimeout(): Promise<void> {
    this.logger.error(` [LocalNetworkClient]: Socket for ${this.duid} timed out.`);
  }

  private async onEnd(): Promise<void> {
    this.logger.debug(` [LocalNetworkClient]: ${this.duid} socket ended.`);
  }

  private async onMessage(message: Buffer): Promise<void> {
    if (!this.socket) {
      return;
    }

    if (!message || message.length == 0) {
      this.logger.debug('[LocalNetworkClient] received empty message from socket.');
      return;
    }

    try {
      this.buffer.append(message);

      const receivedBuffer = this.buffer.get();
      if (!this.isMessageComplete(receivedBuffer)) {
        return;
      }
      this.buffer.reset();

      let offset = 0;
      while (offset + 4 <= receivedBuffer.length) {
        const segmentLength = receivedBuffer.readUInt32BE(offset);
        try {
          const currentBuffer = receivedBuffer.subarray(offset + 4, offset + segmentLength + 4);
          const response = this.deserializer.deserialize(this.duid, currentBuffer, 'LocalNetworkClient');
          this.responseBroadcaster.onResponse(response);
          this.responseBroadcaster.onMessage(response);
        } catch (error) {
          const errMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
          this.logger.error(`[LocalNetworkClient]: unable to process message with error: ${errMsg}`);
        }
        offset += 4 + segmentLength;
      }
    } catch (error) {
      this.logger.error(`[LocalNetworkClient]: read socket buffer error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }
  }

  private isMessageComplete(buffer: Buffer): boolean {
    let totalLength = 0;
    let offset = 0;

    while (offset + 4 <= buffer.length) {
      const segmentLength = buffer.readUInt32BE(offset);
      totalLength += 4 + segmentLength;
      offset += 4 + segmentLength;

      if (offset > buffer.length) {
        return false;
      }
    }

    return totalLength <= buffer.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private safeHandler<T extends (...args: any[]) => Promise<void>>(fn: T): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      fn.apply(this, args).catch((error: unknown) => {
        this.logger.error(`[LocalNetworkClient]: unhandled error in ${fn.name}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      });
    };
  }

  private wrapWithLengthData(buffer: Buffer): Buffer {
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(buffer.length, 0);
    return Buffer.concat([lengthBuffer, buffer]);
  }

  private async trySendHelloRequest(): Promise<void> {
    const isV1 = await this.sendHelloMessage(ProtocolVersion.V1);
    if (!isV1) {
      await this.sendHelloMessage(ProtocolVersion.L01);
    }
  }

  private async sendHelloMessage(version: ProtocolVersion): Promise<boolean> {
    const request = new RequestMessage({
      version: version,
      protocol: Protocol.hello_request,
      messageId: this.messageIdSeq.next(),
      nonce: this.context.nonce,
    });

    try {
      const responsePromise = this.helloResponseListener.waitFor(version);
      await this.send(this.duid, request);
      const response = await responsePromise;
      await this.processHelloResponse(response);
      return true;
    } catch (error) {
      this.logger.error(`[LocalNetworkClient]: ${this.duid} failed to receive hello response: ${error}`);
      return false;
    }
  }

  private async processHelloResponse(response: ResponseMessage): Promise<void> {
    this.logger.info(`[LocalNetworkClient]: ${this.duid} received hello response: ${debugStringify(response)}`);

    if (response.header === undefined) {
      this.logger.error(`[LocalNetworkClient]: ${this.duid} hello response missing header.`);
      return;
    }

    this.context.updateNonce(this.duid, response.header.nonce);
    this.context.updateLocalProtocolVersion(this.duid, response.header.version);
    this.connected = true;

    if (this.checkConnectionInterval) {
      clearInterval(this.checkConnectionInterval);
    }
    this.checkConnectionInterval = setInterval(this.checkConnection.bind(this), 5000);
  }

  private checkingConnection = false;

  private async checkConnection(): Promise<void> {
    if (this.checkingConnection) {
      return;
    }
    this.checkingConnection = true;

    try {
      const now = Date.now();

      if (now - this.pingResponseListener.lastPingResponse > 15000) {
        this.logger.warn(`There is no local ping response for device ${this.duid} for 15s, try reconnect now`);
        await this.disconnect();
        this.connect();
        return;
      }

      await this.sendPingRequest();
    } finally {
      this.checkingConnection = false;
    }
  }

  private async sendPingRequest(): Promise<void> {
    const request = new RequestMessage({
      version: this.context.getLocalProtocolVersion(this.duid),
      protocol: Protocol.ping_request,
      messageId: this.messageIdSeq.next(),
    });
    await this.send(this.duid, request);
  }
}
