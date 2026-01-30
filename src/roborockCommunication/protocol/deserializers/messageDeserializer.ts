import CRC32 from 'crc-32';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Parser } from 'binary-parser/dist/binary_parser.js';
import { ContentMessage, HeaderMessage, MessageContext, Protocol, ResponseBody, ResponseMessage } from '../../models/index.js';
import { ProtocolVersion } from '../../enums/index.js';
import { MessageSerializerFactory } from '../serializers/messageSerializerFactory.js';

export class MessageDeserializer {
  private readonly context: MessageContext;
  private readonly headerMessageParser: Parser;
  private readonly contentMessageParser: Parser;
  private readonly logger: AnsiLogger;
  private readonly supportedVersions: string[] = [ProtocolVersion.V1, ProtocolVersion.A01, ProtocolVersion.B01, ProtocolVersion.L01];
  private readonly protocolsWithoutPayload: Protocol[] = [
    Protocol.hello_request,
    Protocol.hello_response,
    Protocol.ping_request,
    Protocol.ping_response,
    Protocol.general_response,
  ];
  private readonly ignoredProtocols: Protocol[] = [Protocol.map_response];

  private readonly messageSerializerFactory = new MessageSerializerFactory();

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

  public deserialize(duid: string, message: Buffer, from: string): ResponseMessage {
    const rawHeader: HeaderMessage = this.headerMessageParser.parse(message);
    const header = new HeaderMessage(rawHeader.version, rawHeader.seq, rawHeader.nonce, rawHeader.timestamp, rawHeader.protocol);

    this.logger.debug(`[${from}][MessageDeserializer] deserialized header: ${JSON.stringify(header)}`);

    if (!this.supportedVersions.includes(header.version)) {
      throw new Error(`[${from}][MessageDeserializer] unknown protocol: ${header.version ?? ''}`);
    }

    if (this.protocolsWithoutPayload.includes(header.protocol) || this.ignoredProtocols.includes(header.protocol)) {
      return new ResponseMessage(duid, header);
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
      return new ResponseMessage(duid, header);
    }

    const connectNonce = this.context.nonce;
    const ackNonce = this.context.getDeviceNonce(duid);

    const messageSerializer = this.messageSerializerFactory.getMessageSerializer(header.version);
    data.payload = messageSerializer.decode(data.payload, localKey, header.timestamp, header.seq, header.nonce, connectNonce, ackNonce);

    if (header.isForProtocol(Protocol.rpc_response) || header.isForProtocol(Protocol.general_request)) {
      const response = this.deserializeRpcResponse(duid, data, header);
      this.logger.debug(`[${from}][MessageDeserializer] deserialized body: ${debugStringify(response.body ?? {})}`);
      return response;
    } else {
      this.logger.error(`unknown protocol: ${header.protocol}`);
      return new ResponseMessage(duid, header);
    }
  }

  private deserializeRpcResponse(duid: string, data: ContentMessage, header: HeaderMessage): ResponseMessage {
    const payload = JSON.parse(data.payload.toString());
    const dps = payload.dps;
    this.parseJsonInDps(dps, Protocol.general_request);
    this.parseJsonInDps(dps, Protocol.rpc_response);
    return new ResponseMessage(duid, header, new ResponseBody(dps));
  }

  private parseJsonInDps(dps: Record<string, unknown>, index: Protocol) {
    const indexString = index.toString();
    if (dps[indexString] !== undefined) {
      dps[indexString] = JSON.parse(dps[indexString] as string);
    }
  }
}
