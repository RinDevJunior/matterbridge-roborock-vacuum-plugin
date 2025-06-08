import { RequestMessage } from '../broadcast/model/requestMessage.js';
import * as CryptoUtils from './cryptoHelper.js';
import crypto from 'node:crypto';
import CRC32 from 'crc-32';
import { DpsPayload, Payload } from '../broadcast/model/dps.js';
import { MessageContext } from '../broadcast/model/messageContext.js';
import { AnsiLogger } from 'matterbridge/logger';

export class MessageSerializer {
  private readonly context: MessageContext;
  private readonly logger: AnsiLogger;
  private seq = 1;
  private random = 4711;

  constructor(context: MessageContext, logger: AnsiLogger) {
    this.context = context;
    this.logger = logger;
  }

  serialize(duid: string, request: RequestMessage): { messageId: number; buffer: Buffer<ArrayBufferLike> } {
    const messageId = request.messageId;
    const buffer = this.buildBuffer(duid, messageId, request);
    return { messageId: messageId, buffer: buffer };
  }

  private buildPayload(messageId: number, request: RequestMessage): Payload {
    const data: DpsPayload = {
      id: messageId,
      method: request.method ?? '',
      params: request.params,
      security: undefined,
      result: undefined,
    };

    if (request.secure) {
      data.security = {
        endpoint: this.context.getEndpoint(),
        nonce: this.context.getNonceAsHex(),
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    return {
      dps: {
        [request.protocol]: JSON.stringify(data),
      },
      t: timestamp,
    };
  }

  private buildBuffer(duid: string, messageId: number, request: RequestMessage): Buffer<ArrayBufferLike> {
    const version = this.context.getProtocolVersion(duid);
    const localKey = this.context.getLocalKey(duid);

    const payloadData = this.buildPayload(messageId, request);
    const payload = JSON.stringify(payloadData);

    let encrypted;
    if (version == '1.0') {
      const aesKey = CryptoUtils.md5bin(CryptoUtils.encodeTimestamp(payloadData.t) + localKey + CryptoUtils.SALT);
      const cipher = crypto.createCipheriv('aes-128-ecb', aesKey, null);
      encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    } else if (version == 'A01') {
      // 726f626f726f636b2d67a6d6da is in version 4.0 of the roborock app
      const encoder = new TextEncoder();
      const iv = CryptoUtils.md5hex(this.random.toString(16).padStart(8, '0') + '726f626f726f636b2d67a6d6da').substring(8, 24);
      const cipher = crypto.createCipheriv('aes-128-cbc', encoder.encode(localKey), iv);
      encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    } else {
      throw new Error('unable to build the message: unsupported protocol version: ' + version);
    }

    const msg = Buffer.alloc(23 + encrypted.length);
    msg.write(version);
    msg.writeUint32BE(this.seq++ & 0xffffffff, 3);
    msg.writeUint32BE(this.random++ & 0xffffffff, 7);
    msg.writeUint32BE(payloadData.t, 11);
    msg.writeUint16BE(request.protocol, 15);
    msg.writeUint16BE(encrypted.length, 17);
    encrypted.copy(msg, 19);
    const crc32 = CRC32.buf(msg.subarray(0, msg.length - 4)) >>> 0;
    msg.writeUint32BE(crc32, msg.length - 4);
    return msg;
  }
}
