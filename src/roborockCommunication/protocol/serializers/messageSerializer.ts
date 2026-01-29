import CRC32 from 'crc-32';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageContext, Protocol, RequestMessage } from '../../models/index.js';
import { ProtocolVersion } from '../../enums/index.js';
import { MessageBodyBuilderFactory } from '../builders/messageBodyBuilderFactory.js';
import { MessageSerializerFactory } from './messageSerializerFactory.js';

interface SerializeResult {
  messageId: number;
  buffer: Buffer;
}

export class MessageSerializer {
  private readonly context: MessageContext;
  private readonly logger: AnsiLogger;
  private sequence = 1;
  private readonly supportedVersions: string[] = [ProtocolVersion.V1, ProtocolVersion.A01, ProtocolVersion.B01, ProtocolVersion.L01];
  private readonly protocolsWithoutPayload: Protocol[] = [Protocol.hello_request, Protocol.ping_request];
  private readonly messageSerializerFactory = new MessageSerializerFactory();
  private readonly messageBodyBuilderFactory = new MessageBodyBuilderFactory();

  constructor(context: MessageContext, logger: AnsiLogger) {
    this.context = context;
    this.logger = logger;
  }

  public serialize(duid: string, request: RequestMessage): SerializeResult {
    const messageId = request.messageId;
    const buffer = this.buildBuffer(duid, messageId, request);
    return { messageId: messageId, buffer: buffer };
  }

  private buildBuffer(duid: string, messageId: number, request: RequestMessage): Buffer {
    const version = request.version ?? this.context.getProtocolVersion(duid);
    if (!version || !this.supportedVersions.includes(version)) {
      throw new Error(`[MessageSerializer] unknown protocol: ${version ?? ''}`);
    }
    let encrypted;
    if (this.protocolsWithoutPayload.includes(request.protocol)) {
      encrypted = Buffer.alloc(0);
    } else {
      const localKey = this.context.getLocalKey(duid);
      if (!localKey) {
        throw new Error(`no local key for device ${duid}`);
      }

      const messageBodyBuilder = this.messageBodyBuilderFactory.getMessageBodyBuilder(version, request.body !== undefined);
      const messageSerializer = this.messageSerializerFactory.getMessageSerializer(version);
      const payloadData = messageBodyBuilder.buildPayload(request, this.context);
      const connectNonce = this.context.nonce;
      const ackNonce = this.context.getDeviceNonce(duid);
      encrypted = messageSerializer.encode(payloadData, localKey, request.timestamp, this.sequence, request.nonce, connectNonce, ackNonce);
    }

    const msg = Buffer.alloc(23 + encrypted.length);
    msg.write(version);
    msg.writeUint32BE(this.sequence++ & 0xffffffff, 3);
    msg.writeUint32BE(request.nonce & 0xffffffff, 7);
    msg.writeUint32BE(request.timestamp, 11);
    msg.writeUint16BE(request.protocol, 15);
    msg.writeUint16BE(encrypted.length, 17);
    encrypted.copy(msg, 19);
    const crc32 = CRC32.buf(msg.subarray(0, msg.length - 4)) >>> 0;
    msg.writeUint32BE(crc32, msg.length - 4);
    return msg;
  }
}
