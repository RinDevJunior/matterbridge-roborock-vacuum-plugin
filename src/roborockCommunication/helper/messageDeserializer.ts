import crypto from 'node:crypto';
import CRC32 from 'crc-32';
import { ResponseMessage } from '../broadcast/model/responseMessage.js';
import * as CryptoUtils from './cryptoHelper.js';
import { Protocol } from '../broadcast/model/protocol.js';
import { MessageContext } from '../broadcast/model/messageContext.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Parser } from 'binary-parser/dist/binary_parser.js';
import { ContentMessage } from '../broadcast/model/contentMessage.js';
import { HeaderMessage } from '../broadcast/model/headerMessage.js';
import { DpsPayload } from '../broadcast/model/dps.js';

export class MessageDeserializer {
  private readonly context: MessageContext;
  private readonly headerMessageParser: Parser;
  private readonly contentMessageParser: Parser;
  private readonly logger: AnsiLogger;
  private readonly supportedVersions: string[] = ['1.0', 'A01', 'B01'];

  constructor(context: MessageContext, logger: AnsiLogger) {
    this.context = context;
    this.logger = logger;

    this.headerMessageParser = new Parser()
      .endianness('big')
      .string('version', {
        length: 3,
      })
      .uint32('seq')
      .uint32('nonce')
      .uint32('timestamp')
      .uint16('protocol');

    this.contentMessageParser = new Parser()
      .endianness('big')
      .uint16('payloadLen')
      .buffer('payload', {
        length: 'payloadLen',
      })
      .uint32('crc32');
  }

  public deserialize(duid: string, message: Buffer<ArrayBufferLike>): ResponseMessage {
    // check message header
    const header: HeaderMessage = this.headerMessageParser.parse(message);
    if (!this.supportedVersions.includes(header.version)) {
      throw new Error('unknown protocol version ' + header.version);
    }

    if (header.protocol === Protocol.hello_response || header.protocol === Protocol.ping_response) {
      const dpsValue: DpsPayload = {
        id: header.seq,
        result: {
          version: header.version,
          nonce: header.nonce,
        },
      };
      return new ResponseMessage(duid, { [header.protocol.toString()]: dpsValue });
    }

    // parse message content
    const data: ContentMessage = this.contentMessageParser.parse(message.subarray(this.headerMessageParser.sizeOf()));

    // check crc32
    const crc32 = CRC32.buf(message.subarray(0, message.length - 4)) >>> 0;
    const expectedCrc32 = message.readUInt32BE(message.length - 4);
    if (crc32 != expectedCrc32) {
      throw new Error(`Wrong CRC32 ${crc32}, expected ${expectedCrc32}`);
    }

    const localKey = this.context.getLocalKey(duid);
    if (!localKey) {
      this.logger.notice(`Unable to retrieve local key for ${duid}, it should be from other vacuums`);
      return new ResponseMessage(duid, { dps: { id: 0, result: null } });
    }

    if (header.version == '1.0') {
      const aesKey = CryptoUtils.md5bin(CryptoUtils.encodeTimestamp(header.timestamp) + localKey + CryptoUtils.SALT);
      const decipher = crypto.createDecipheriv('aes-128-ecb', aesKey, null);
      data.payload = Buffer.concat([decipher.update(data.payload), decipher.final()]);
    } else if (header.version == 'A01') {
      const iv = CryptoUtils.md5hex(header.nonce.toString(16).padStart(8, '0') + '726f626f726f636b2d67a6d6da').substring(8, 24);
      const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
      data.payload = Buffer.concat([decipher.update(data.payload), decipher.final()]);
    } else if (header.version == 'B01') {
      const iv = CryptoUtils.md5hex(header.nonce.toString(16).padStart(8, '0') + '5wwh9ikChRjASpMU8cxg7o1d2E').substring(9, 25);
      const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
      // unpad ??
      data.payload = Buffer.concat([decipher.update(data.payload), decipher.final()]);
    }

    // map visualization not support
    if (header.protocol == Protocol.map_response) {
      return new ResponseMessage(duid, { dps: { id: 0, result: null } });
    }

    if (header.protocol == Protocol.rpc_response || header.protocol == Protocol.general_request) {
      return this.deserializeRpcResponse(duid, data);
    } else {
      this.logger.error('unknown protocol: ' + header.protocol);
      return new ResponseMessage(duid, { dps: { id: 0, result: null } });
    }
  }

  private deserializeRpcResponse(duid: string, data: ContentMessage): ResponseMessage {
    const payload = JSON.parse(data.payload.toString());
    const dps = payload.dps;
    this.parseJsonInDps(dps, Protocol.general_request);
    this.parseJsonInDps(dps, Protocol.rpc_response);
    return new ResponseMessage(duid, dps);
  }

  private parseJsonInDps(dps: Record<string, unknown>, index: Protocol) {
    const indexString = index.toString();
    if (dps[indexString] !== undefined) {
      dps[indexString] = JSON.parse(dps[indexString] as string);
    }
  }
}
