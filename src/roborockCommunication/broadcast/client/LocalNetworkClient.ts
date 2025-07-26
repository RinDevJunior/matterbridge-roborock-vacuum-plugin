import { Socket } from 'node:net';
import { clearInterval } from 'node:timers';
import { Protocol } from '../model/protocol.js';
import { RequestMessage } from '../model/requestMessage.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AbstractClient } from '../abstractClient.js';
import { MessageContext } from '../model/messageContext.js';
import { Sequence } from '../../helper/sequence.js';
import { ChunkBuffer } from '../../helper/chunkBuffer.js';

export class LocalNetworkClient extends AbstractClient {
  protected override clientName = 'LocalNetworkClient';
  protected override shouldReconnect = true;

  private socket: Socket | undefined = undefined;
  private buffer: ChunkBuffer = new ChunkBuffer();
  private messageIdSeq: Sequence;
  private pingInterval?: NodeJS.Timeout;
  private keepConnectionAliveInterval: NodeJS.Timeout | undefined = undefined;
  duid: string;
  ip: string;

  constructor(logger: AnsiLogger, context: MessageContext, duid: string, ip: string) {
    super(logger, context);
    this.duid = duid;
    this.ip = ip;
    this.messageIdSeq = new Sequence(100000, 999999);

    this.initializeConnectionStateListener();
  }

  public connect(): void {
    if (this.socket) {
      return; // Already connected
    }

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

    this.keepConnectionAlive();
  }

  public async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    this.isInDisconnectingStep = true;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.socket.destroy();
    this.socket = undefined;
  }

  public async send(duid: string, request: RequestMessage): Promise<void> {
    if (!this.socket || !this.connected) {
      this.logger.error(`${duid}: socket is not online, , ${debugStringify(request)}`);
      return;
    }

    const localRequest = request.toLocalRequest();
    const message = this.serializer.serialize(duid, localRequest);

    this.logger.debug(`sending message ${message.messageId}, protocol:${localRequest.protocol}, method:${localRequest.method}, secure:${request.secure} to ${duid}`);
    this.socket.write(this.wrapWithLengthData(message.buffer));
  }

  private async onConnect(): Promise<void> {
    this.logger.debug(` [LocalNetworkClient]: ${this.duid} connected to ${this.ip}`);
    this.logger.debug(` [LocalNetworkClient]: ${this.duid} socket writable: ${this.socket?.writable}, readable: ${this.socket?.readable}`);

    await this.sendHelloMessage();
    this.pingInterval = setInterval(this.sendPingRequest.bind(this), 5000);

    this.connected = true;
    this.retryCount = 0;
    await this.connectionListeners.onConnected(this.duid);
  }

  private async onDisconnect(hadError: boolean): Promise<void> {
    this.logger.info(` [LocalNetworkClient]: ${this.duid} socket disconnected. Had error: ${hadError}`);
    this.connected = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    await this.connectionListeners.onDisconnected(this.duid, 'Socket disconnected. Had no error.');
  }

  private async onError(error: Error): Promise<void> {
    this.logger.error(` [LocalNetworkClient]: Socket error for ${this.duid}: ${error.message}`);
    await this.connectionListeners.onError(this.duid, error.message);
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
      this.logger.debug('LocalNetworkClient received empty message from socket.');
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
          const response = this.deserializer.deserialize(this.duid, currentBuffer);
          await this.messageListeners.onMessage(response);
        } catch (error) {
          this.logger.error('LocalNetworkClient: unable to process message with error: ' + error);
          // unable to process message: TypeError: Cannot read properties of undefined (reading 'length')
        }
        offset += 4 + segmentLength;
      }
    } catch (error) {
      this.logger.error('LocalNetworkClient: read socket buffer error: ' + error);
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

  private async sendHelloMessage(): Promise<void> {
    const request = new RequestMessage({
      protocol: Protocol.hello_request,
      messageId: this.messageIdSeq.next(),
    });

    await this.send(this.duid, request);
  }

  private async sendPingRequest(): Promise<void> {
    const request = new RequestMessage({
      protocol: Protocol.ping_request,
      messageId: this.messageIdSeq.next(),
    });
    await this.send(this.duid, request);
  }

  private keepConnectionAlive(): void {
    if (this.keepConnectionAliveInterval) {
      clearTimeout(this.keepConnectionAliveInterval);
      this.keepConnectionAliveInterval.unref();
    }

    this.keepConnectionAliveInterval = setInterval(
      () => {
        if (this.socket === undefined || !this.connected || !this.socket.writable || this.socket.readable) {
          this.logger.debug(` [LocalNetworkClient]: ${this.duid} socket is not writable or readable, reconnecting...`);
          this.connect();
        }
      },
      60 * 60 * 1000,
    );
  }
}
