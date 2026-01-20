import * as dgram from 'node:dgram';
import { Socket } from 'node:dgram';
import { Parser } from 'binary-parser/dist/binary_parser.js';
import crypto from 'node:crypto';
import CRC32 from 'crc-32';
import { AnsiLogger } from 'matterbridge/logger';
import { AbstractUDPMessageListener, NetworkInfo, ProtocolVersion } from '../../index.js';

export class LocalNetworkUDPClient {
  private readonly PORT = 58866;
  private server: Socket | undefined = undefined;
  private listeners: AbstractUDPMessageListener[] = [];

  private readonly V10Parser: Parser;
  private readonly L01Parser: Parser;

  constructor(private readonly logger: AnsiLogger) {
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
  }

  public registerListener(listener: AbstractUDPMessageListener): void {
    this.listeners.push(listener);
  }

  public connect(): void {
    try {
      this.server = dgram.createSocket('udp4');
      this.server.bind(this.PORT);

      this.server.on('message', this.onMessage.bind(this));
      this.server.on('error', this.onError.bind(this));
    } catch (err) {
      this.logger.error(`[LocalNetworkUDPClient] Failed to create UDP server: ${err}`);
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

  private async onError(result: Error): Promise<void> {
    this.logger.error(`[LocalNetworkUDPClient] UDP socket error: ${result}`);

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
    return Promise.resolve();
  }

  private async onMessage(buffer: Buffer) {
    const message = await this.deserializeMessage(buffer);
    this.logger.debug(`[LocalNetworkUDPClient] Received message: ${JSON.stringify(message)}`);
    for (const listener of this.listeners) {
      await listener.onMessage(message.duid, message.ip);
    }
  }

  private async deserializeMessage(buffer: Buffer): Promise<NetworkInfo> {
    const version = buffer.toString('latin1', 0, 3);
    let data;
    switch (version) {
      case ProtocolVersion.V1:
        data = await this.deserializeV10Message(buffer);
        return JSON.parse(data);
      case ProtocolVersion.L01:
        data = await this.deserializeL01Message(buffer);
        return JSON.parse(data);
      default:
        throw new Error(`[LocalNetworkUDPClient] Unsupported protocol version: ${version}`);
    }
  }

  private async deserializeV10Message(buffer: Buffer<ArrayBufferLike>): Promise<string> {
    const data = this.V10Parser.parse(buffer);

    const crc32 = CRC32.buf(buffer.subarray(0, buffer.length - 4)) >>> 0;
    const expectedCrc32 = data.crc32;
    if (crc32 != expectedCrc32) {
      throw new Error(`[LocalNetworkUDPClient] wrong CRC32: ${crc32}, expect: ${expectedCrc32}`);
    }

    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from('qWKYcdQWrbm9hPqe', 'utf8'), null);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(data.payload, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
    return decrypted.slice(0, -paddingLength);
  }

  private async deserializeL01Message(buffer: Buffer<ArrayBufferLike>): Promise<string> {
    const data = this.L01Parser.parse(buffer);
    const crc32 = CRC32.buf(buffer.subarray(0, buffer.length - 4)) >>> 0;
    const expectedCrc32 = data.crc32;
    if (crc32 != expectedCrc32) {
      throw new Error(`[LocalNetworkUDPClient] wrong CRC32: ${crc32}, expect: ${expectedCrc32}`);
    }

    const payload = data.payload;
    const key = crypto.createHash('sha256').update(Buffer.from('qWKYcdQWrbm9hPqe', 'utf8')).digest();
    const digestInput = buffer.subarray(0, 9);
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
      const exception = e as Error;
      throw new Error(`[LocalNetworkUDPClient] failed to decrypt: ${exception.message}
        iv: ${iv.toString('hex')}
        tag: ${tag.toString('hex')}
        encrypted: ${ciphertext.toString('hex')}`);
    }
  }
}
