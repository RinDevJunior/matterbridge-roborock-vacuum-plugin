import * as dgram from 'node:dgram';
import { Socket } from 'node:dgram';
import { Parser } from 'binary-parser';
import crypto from 'crypto';
import CRC32 from 'crc-32';
import { AnsiLogger } from 'matterbridge/logger';
import { AbstractClient } from '../abstractClient.js';
import { RequestMessage, ResponseMessage } from '../../index.js';
import { MessageContext } from '../model/messageContext.js';

export class LocalNetworkUDPClient extends AbstractClient {
  protected override clientName = 'LocalNetworkUDPClient';
  protected override shouldReconnect = false;
  protected override changeToSecureConnection = (duid: string) => {
    void 0;
  };

  private readonly PORT = 58866;
  private server: Socket | undefined = undefined;
  private readonly V10Parser: Parser<any>;
  private readonly L01Parser: Parser<any>;

  constructor(logger: AnsiLogger, context: MessageContext, duid: string, ip: string, inject: (duid: string) => void) {
    super(logger, context);
    this.V10Parser = new Parser()
      .endianness('big')
      .string('version', { length: 3 })
      .uint32('seq')
      .uint16('protocol')
      .uint16('payloadLen')
      .buffer('payload', { length: 'payloadLen' })
      .uint32('crc32');

    this.L01Parser = new Parser()
      .endianness('big')
      .string('version', { length: 3 })
      .string('field1', { length: 4 })
      .string('field2', { length: 2 })
      .uint16('payloadLen')
      .buffer('payload', { length: 'payloadLen' })
      .uint32('crc32');

    this.logger = logger;
  }

  public connect(): void {
    try {
      this.server = dgram.createSocket('udp4');
      this.server.bind(this.PORT);

      this.server.on('message', this.onMessage.bind(this));
      this.server.on('error', this.onError.bind(this));
    } catch (err) {
      this.logger.error(`Failed to create UDP socket: ${err}`);
      this.server = undefined;
    }
  }

  public disconnect(): Promise<void> {
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server?.close(() => {
          this.server = undefined;
          resolve();
        });
      });
    }

    return Promise.resolve();
  }

  public override send(duid: string, request: RequestMessage): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async onError(result: any) {
    this.logger.error(`UDP socket error: ${result}`);

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  private async onMessage(buffer: Buffer) {
    const message = await this.deserializeMessage(buffer);
    this.logger.debug('Received message: ' + JSON.stringify(message));
  }

  private async deserializeMessage(buffer: Buffer): Promise<ResponseMessage | undefined> {
    const version = buffer.toString('latin1', 0, 3);

    if (version !== '1.0' && version !== 'L01' && version !== 'A01') {
      throw new Error('unknown protocol version ' + version);
    }

    let data;
    switch (version) {
      case '1.0':
        data = await this.deserializeV10Message(buffer);
        return JSON.parse(data);
      case 'L01':
        data = await this.deserializeL01Message(buffer);
        return JSON.parse(data);
      case 'A01':
        // TODO: Implement A01 deserialization
        return undefined; // Placeholder for A01 deserialization
      default:
        throw new Error('unknown protocol version ' + version);
    }
  }

  private async deserializeV10Message(message: Buffer<ArrayBufferLike>): Promise<string> {
    const data = this.V10Parser.parse(message);
    const crc32 = CRC32.buf(message.subarray(0, message.length - 4)) >>> 0;
    const expectedCrc32 = data.crc32;
    if (crc32 != expectedCrc32) {
      throw new Error('wrong CRC32 ' + crc32 + ', expected ' + expectedCrc32);
    }

    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from('qWKYcdQWrbm9hPqe', 'utf8'), null);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(data.payload, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
    return decrypted.slice(0, -paddingLength);
  }

  private async deserializeL01Message(message: Buffer<ArrayBufferLike>): Promise<string> {
    const data = this.L01Parser.parse(message);
    const crc32 = CRC32.buf(message.subarray(0, message.length - 4)) >>> 0;
    const expectedCrc32 = data.crc32;
    if (crc32 != expectedCrc32) {
      throw new Error('wrong CRC32 ' + crc32 + ', expected ' + expectedCrc32);
    }

    const payload = data.payload;
    const key = crypto.createHash('sha256').update(Buffer.from('qWKYcdQWrbm9hPqe', 'utf8')).digest();
    const digestInput = message.subarray(0, 9);
    const digest = crypto.createHash('sha256').update(digestInput).digest();
    const iv = digest.subarray(0, 12);
    const tag = payload.subarray(payload.length - 16);
    const ciphertext = payload.subarray(0, payload.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? (e as any).message : String(e);
      throw new Error('failed to decrypt: ' + message + ' / iv: ' + iv.toString('hex') + ' / tag: ' + tag.toString('hex') + ' / encrypted: ' + ciphertext.toString('hex'));
    }
  }
}
