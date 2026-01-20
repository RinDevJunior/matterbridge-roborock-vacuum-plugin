import { Socket } from 'node:net';
import { clearInterval } from 'node:timers';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import {
  Protocol,
  RequestMessage,
  MessageContext,
  ResponseMessage,
  ProtocolVersion,
  PingResponseListener,
  SyncMessageListener,
  Sequence,
  ChunkBuffer,
} from '@/roborockCommunication/index.js';
import { AbstractClient } from '../abstractClient.js';

export class LocalNetworkClient extends AbstractClient {
  protected override clientName = 'LocalNetworkClient';

  private socket: Socket | undefined = undefined;
  private buffer: ChunkBuffer = new ChunkBuffer();
  private messageIdSeq: Sequence;
  private pingInterval?: NodeJS.Timeout;
  private pingResponseListener: PingResponseListener;

  public duid: string;
  public ip: string;

  constructor(logger: AnsiLogger, context: MessageContext, duid: string, ip: string, syncMessageListener?: SyncMessageListener) {
    super(logger, context, syncMessageListener);
    this.duid = duid;
    this.ip = ip;
    this.messageIdSeq = new Sequence(100000, 999999);

    this.pingResponseListener = new PingResponseListener(this.duid);
    this.messageListeners.register(this.pingResponseListener);
  }

  public isReady(): boolean {
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
    this.socket = new Socket();

    // Socket event listeners
    this.socket.on('close', this.onDisconnect.bind(this));
    this.socket.on('end', this.onEnd.bind(this));
    this.socket.on('error', this.onError.bind(this));
    this.socket.on('connect', this.onConnect.bind(this));
    this.socket.on('timeout', this.onTimeout.bind(this));

    // Data event listener
    this.socket.on('data', this.onMessage.bind(this));
    this.socket.connect(58867, this.ip);
  }

  public override async disconnect(): Promise<void> {
    if (!this.socket) {
      return Promise.resolve();
    }

    await super.disconnect();

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
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

    const protocolVersion = request.version ?? this.context.getProtocolVersion(duid);
    const localRequest = request.toLocalRequest(protocolVersion);
    const message = this.serializer.serialize(duid, localRequest);

    this.logger.debug(
      `[LocalNetworkClient] sending message ${message.messageId}, protocol version: ${localRequest.version}, protocol:${Protocol[localRequest.protocol]}, method:${localRequest.method}, secure:${request.secure} to ${duid}`,
    );
    this.socket.write(this.wrapWithLengthData(message.buffer));
    this.logger.debug(`[LocalNetworkClient] sent message ${message.messageId} to ${duid}`);
  }

  private async onConnect(): Promise<void> {
    this.logger.debug(` [LocalNetworkClient]: ${this.duid} connected to ${this.ip}`);
    this.logger.debug(` [LocalNetworkClient]: ${this.duid} socket writable: ${this.socket?.writable}, readable: ${this.socket?.readable}`);
    await this.trySendHelloRequest();
  }

  private async onDisconnect(hadError: boolean): Promise<void> {
    this.logger.info(` [LocalNetworkClient]: ${this.duid} socket disconnected. Had error: ${hadError}`);

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (!this.connected) {
      await this.connectionListeners.onDisconnected(this.duid, 'Socket disconnected. Had no error.');
    }
    this.connected = false;
  }

  private async onError(error: Error): Promise<void> {
    this.logger.error(` [LocalNetworkClient]: Socket error for ${this.duid}: ${error.message}`);

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }

    if (!this.connected) {
      await this.connectionListeners.onDisconnected(this.duid, `Socket error: ${error.message}`);
    }
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
        if (segmentLength == 17) {
          offset += 4 + segmentLength;
          continue;
        }

        try {
          const currentBuffer = receivedBuffer.subarray(offset + 4, offset + segmentLength + 4);
          const response = this.deserializer.deserialize(this.duid, currentBuffer, 'LocalNetworkClient');
          await this.messageListeners.onMessage(response);
        } catch (error) {
          const errMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
          this.logger.error(`[LocalNetworkClient]: unable to process message with error: ${errMsg}`);
        }
        offset += 4 + segmentLength;
      }
    } catch (error) {
      this.logger.error('[LocalNetworkClient]: read socket buffer error: ' + error);
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

  private wrapWithLengthData(buffer: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
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

    await this.send(this.duid, request);

    try {
      const response = await this.pingResponseListener.waitFor();
      await this.processHelloResponse(response);
      return true;
    } catch (error) {
      this.logger.error(` [LocalNetworkClient]: ${this.duid} failed to receive hello response: ${error}`);
      return false;
    }
  }

  private async processHelloResponse(response: ResponseMessage): Promise<void> {
    this.logger.info(` [LocalNetworkClient]: ${this.duid} received hello response: ${debugStringify(response)}`);

    if (response.header === undefined) {
      this.logger.error(` [LocalNetworkClient]: ${this.duid} hello response missing header.`);
      return;
    }

    this.context.updateNonce(this.duid, response.header.nonce);
    this.context.updateProtocolVersion(this.duid, response.header.version);
    this.connected = true;
    this.pingInterval = setInterval(this.sendPingRequest.bind(this), 5000);
  }

  private async sendPingRequest(): Promise<void> {
    const request = new RequestMessage({
      version: this.context.getProtocolVersion(this.duid),
      protocol: Protocol.ping_request,
      messageId: this.messageIdSeq.next(),
    });
    await this.send(this.duid, request);
  }
}
