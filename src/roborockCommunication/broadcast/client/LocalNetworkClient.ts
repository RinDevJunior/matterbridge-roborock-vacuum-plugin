import { Socket } from 'node:net';
import AbstractClient from '../abstractClient.js';
import MessageContext from '../model/messageContext.js';
import { Protocol } from '../model/protocol.js';
import { RequestMessage } from '../model/requestMessage.js';
import { AnsiLogger } from 'node-ansi-logger';
import ChunkBuffer from '../../helper/chunkBuffer.js';
import Sequence from '../../helper/sequence.js';

export default class LocalNetworkClient extends AbstractClient {
  private readonly PORT = 58867;
  private readonly PING_INTERVAL_MS = 5000;

  private readonly duid: string;
  private readonly ip: string;

  private socket: Socket | undefined = undefined;
  private buffer: ChunkBuffer = new ChunkBuffer();

  private messageIdSeq: Sequence;

  private pingInterval?: NodeJS.Timeout;

  public constructor(logger: AnsiLogger, context: MessageContext, duid: string, ip: string) {
    super(logger, context);
    this.duid = duid;
    this.ip = ip;

    this.messageIdSeq = new Sequence(100000, 999999);
  }

  public connect(): void {
    this.socket = new Socket();

    // connection events
    this.socket.on('close', this.onDisconnect.bind(this));
    this.socket.on('end', this.onDisconnect.bind(this));
    this.socket.on('error', this.onError.bind(this));

    // data events
    this.socket.on('data', this.onData.bind(this));

    this.socket.connect(this.PORT, this.ip, this.onConnect.bind(this));
  }

  private async onConnect() {
    this.logger.debug('TCP client for ' + this.duid + ' connected');

    await this.sendHello();
    this.pingInterval = setInterval(this.sendPing.bind(this), this.PING_INTERVAL_MS);

    this.connected = true;
    await this.connectionListeners.onConnected();
  }

  private async onDisconnect() {
    this.logger.info('Socket has disconnected.');
    this.connected = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    await this.connectionListeners.onDisconnected();
  }

  private async onError(result: any) {
    this.logger.error('Socket connection error: ' + result);
    this.connected = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }

    await this.connectionListeners.onError(result.toString());
  }

  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.socket.destroy();
    this.socket = undefined;
  }

  private async onData(message: Buffer) {
    if (!this.socket) {
      this.logger.error('unable to receive data if there is no socket available');
      return;
    }

    try {
      this.buffer.append(message);

      const recvBuffer = this.buffer.get();
      if (!this.isMessageComplete(recvBuffer)) {
        return;
      }
      this.buffer.reset();

      let offset = 0;
      while (offset + 4 <= recvBuffer.length) {
        const segmentLength = recvBuffer.readUInt32BE(offset);
        if (segmentLength == 17) {
          offset += 4 + segmentLength;
          continue;
        }

        try {
          const currentBuffer = recvBuffer.subarray(offset + 4, offset + segmentLength + 4);
          const response = this.deserializer.deserialize(this.duid, currentBuffer);
          await this.messageListeners.onMessage(response);
        } catch (error) {
          this.logger.error('unable to process message: ' + error);
        }
        offset += 4 + segmentLength;
      }
    } catch (error) {
      this.logger.error('failed to read from a socket: ' + error);
    }
  }

  private isMessageComplete(buffer: Buffer) {
    let totalLength = 0;
    let offset = 0;

    while (offset + 4 <= buffer.length) {
      const segmentLength = buffer.readUInt32BE(offset);
      totalLength += 4 + segmentLength;
      offset += 4 + segmentLength;

      if (offset > buffer.length) {
        return false; // Data is not complete yet
      }
    }

    return totalLength <= buffer.length;
  }

  async send(duid: string, request: RequestMessage): Promise<void> {
    if (!this.socket || !this.connected) {
      this.logger.error('failed to send request to ' + duid + ', socket is not online');
      return;
    }

    const localRequest = request.toLocalRequest();
    const message = this.serializer.serialize(duid, localRequest);

    this.logger.debug('sending message ' + localRequest.protocol + '/' + localRequest.method + '/' + request.secure + ' to ' + duid + ' with id ' + message.messageId);
    this.socket.write(this.wrapWithLengthData(message.buffer));
  }

  private wrapWithLengthData(buffer: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(buffer.length, 0);
    return Buffer.concat([lengthBuffer, buffer]);
  }

  private async sendHello() {
    const request = new RequestMessage({
      protocol: Protocol.hello_request,
      messageId: this.messageIdSeq.next(),
    });
    await this.send(this.duid, request);
  }

  private async sendPing() {
    const request = new RequestMessage({
      protocol: Protocol.ping_request,
      messageId: this.messageIdSeq.next(),
    });
    await this.send(this.duid, request);
  }
}
