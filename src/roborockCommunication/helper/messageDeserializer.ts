import crypto from 'node:crypto';
import CRC32 from 'crc-32';
// @ts-expect-error: binary-parser has no type definitions, using as-is for runtime parsing
import { Parser } from 'binary-parser';
import { ResponseMessage } from '../broadcast/model/responseMessage.js';
import * as CryptoUtils from './cryptoHelper.js';
import { Protocol } from '../broadcast/model/protocol.js';
import { MessageContext } from '../broadcast/model/messageContext.js';
import { AnsiLogger } from 'matterbridge/logger';

export interface Message {
  version: string;
  seq: number;
  random: number;
  timestamp: number;
  protocol: number;
  payloadLen?: number;
  payload: Buffer<ArrayBufferLike>;
  crc32: number;
}

export class MessageDeserializer {
  private readonly context: MessageContext;
  private readonly messageParser: Parser;
  private readonly logger: AnsiLogger;

  constructor(context: MessageContext, logger: AnsiLogger) {
    this.context = context;
    this.logger = logger;

    this.messageParser = new Parser()
      .endianess('big')
      .string('version', {
        length: 3,
      })
      .uint32('seq')
      .uint32('random')
      .uint32('timestamp')
      .uint16('protocol')
      .uint16('payloadLen')
      .buffer('payload', {
        length: 'payloadLen',
      })
      .uint32('crc32');
  }

  public deserialize(duid: string, message: Buffer<ArrayBufferLike>): ResponseMessage {
    const version = message.toString('latin1', 0, 3);
    if (version !== '1.0' && version !== 'A01') {
      throw new Error('unknown protocol version ' + version);
    }

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

    const data: Message = this.messageParser.parse(message);

    if (version == '1.0') {
      const aesKey = CryptoUtils.md5bin(CryptoUtils.encodeTimestamp(data.timestamp) + localKey + CryptoUtils.SALT);
      const decipher = crypto.createDecipheriv('aes-128-ecb', aesKey, null);
      data.payload = Buffer.concat([decipher.update(data.payload), decipher.final()]);
    } else if (version == 'A01') {
      const iv = CryptoUtils.md5hex(data.random.toString(16).padStart(8, '0') + '726f626f726f636b2d67a6d6da').substring(8, 24);
      const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
      data.payload = Buffer.concat([decipher.update(data.payload), decipher.final()]);
    }

    // map visualization not support
    if (data.protocol == Protocol.map_response) {
      return new ResponseMessage(duid, { dps: { id: 0, result: null } });
    }

    if (data.protocol == Protocol.rpc_response || data.protocol == Protocol.general_request) {
      return this.deserializeProtocolRpcResponse(duid, data);
    } else {
      this.logger.error('unknown protocol: ' + data.protocol);
      return new ResponseMessage(duid, { dps: { id: 0, result: null } });
    }
  }

  private deserializeProtocolRpcResponse(duid: string, data: Message): ResponseMessage {
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
