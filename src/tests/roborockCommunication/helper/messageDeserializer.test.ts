import { describe, it, expect, vi, beforeEach } from 'vitest';
import CRC32 from 'crc-32';
import { MessageDeserializer } from '../../../roborockCommunication/protocol/deserializers/messageDeserializer.js';
import { Protocol, MessageContext, UserData } from '../../../roborockCommunication/models/index.js';
import { asPartial, asType, mkUser } from '../../helpers/testUtils.js';
import { MessageSerializerFactory } from '../../../roborockCommunication/protocol/serializers/messageSerializerFactory.js';
import { makeLogger } from '../../testUtils.js';

describe('MessageDeserializer', () => {
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('returns ResponseMessage for protocols without payload', () => {
    const context = new MessageContext(mkUser());
    const des = new MessageDeserializer(context, logger);

    // build header buffer: version(3) + seq(4) + nonce(4) + timestamp(4) + protocol(2)
    const buf = Buffer.alloc(17);
    buf.write('A01', 0, 3, 'ascii');
    buf.writeUInt32BE(1, 3); // seq
    buf.writeUInt32BE(2, 7); // nonce
    buf.writeUInt32BE(3, 11); // timestamp
    buf.writeUInt16BE(Protocol.hello_response, 15);

    const res = des.deserialize('duid', buf, 'from');
    expect(res.isForProtocol(Protocol.hello_response)).toBe(true);
  });

  it('throws on unsupported protocol version', () => {
    const context = new MessageContext(mkUser());
    const des = new MessageDeserializer(context, logger);
    const buf = Buffer.alloc(17);
    buf.write('BAD', 0, 3, 'ascii');
    buf.writeUInt32BE(0, 3);
    buf.writeUInt32BE(0, 7);
    buf.writeUInt32BE(0, 11);
    buf.writeUInt16BE(Protocol.rpc_response, 15);
    expect(() => des.deserialize('duid', buf, 'from')).toThrow(/unknown protocol/);
  });

  it('parses rpc_response and returns a body with parsed dps', async () => {
    vi.spyOn(MessageSerializerFactory.prototype, 'getMessageSerializer').mockReturnValue({
      encode: (_payload: string, _localKey: string, _timestamp: number, _sequence: number, _nonce: number) => Buffer.alloc(0),
      decode: (_payload: Buffer) => Buffer.from(JSON.stringify({ dps: { '102': JSON.stringify({ x: 1 }) } })),
    });

    const context = new MessageContext(asType<UserData>({ rriot: { k: 'k' } }));
    context.registerDevice('duid', 'local', 'A01', 9);
    const des = new MessageDeserializer(context, logger);

    const header = Buffer.alloc(17);
    header.write('A01', 0, 3, 'ascii');
    header.writeUInt32BE(1, 3);
    header.writeUInt32BE(2, 7);
    header.writeUInt32BE(3, 11);
    header.writeUInt16BE(Protocol.rpc_response, 15);

    const decodedPayload = Buffer.from('encrypted');
    const contentLen = Buffer.alloc(2);
    contentLen.writeUInt16BE(decodedPayload.length, 0);

    const preCrc = Buffer.concat([header, contentLen, decodedPayload]);
    const crc = CRC32.buf(preCrc) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    const full = Buffer.concat([preCrc, crcBuf]);

    const res = des.deserialize('duid', full, 'from');
    expect(res.isForProtocol(Protocol.rpc_response)).toBe(true);
    const body = res.body;
    expect(body).toBeDefined();
    expect(body?.data['102']).toBeDefined();
    const item = body?.data['102'];
    const parsed = typeof item === 'string' ? JSON.parse(item) : JSON.parse(JSON.stringify(item));
    expect(parsed.x).toBe(1);
  });

  it('handles unknown protocol and returns ResponseMessage without throwing', async () => {
    vi.spyOn(MessageSerializerFactory.prototype, 'getMessageSerializer').mockReturnValue({
      encode: (_payload: string, _localKey: string, _timestamp: number, _sequence: number, _nonce: number) => Buffer.alloc(0),
      decode: (_payload: Buffer) => Buffer.from(JSON.stringify({ dps: { test: 'data' } })),
    });

    const context = new MessageContext(asType<UserData>({ rriot: { k: 'k' } }));
    context.registerDevice('duid', 'local', 'A01', 9);
    const des = new MessageDeserializer(context, logger);

    const header = Buffer.alloc(17);
    header.write('A01', 0, 3, 'ascii');
    header.writeUInt32BE(1, 3);
    header.writeUInt32BE(2, 7);
    header.writeUInt32BE(3, 11);
    header.writeUInt16BE(999, 15);

    const decodedPayload = Buffer.from('encrypted');
    const contentLen = Buffer.alloc(2);
    contentLen.writeUInt16BE(decodedPayload.length, 0);

    const preCrc = Buffer.concat([header, contentLen, decodedPayload]);
    const crc = CRC32.buf(preCrc) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    const full = Buffer.concat([preCrc, crcBuf]);

    const res = des.deserialize('duid', full, 'from');
    expect(res).toBeDefined();
    expect(logger.error).toHaveBeenCalledWith('unknown protocol: 999');
  });
});
