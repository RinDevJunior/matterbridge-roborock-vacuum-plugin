import { describe, it, expect, vi, beforeEach } from 'vitest';
import CRC32 from 'crc-32';
import { MessageDeserializer } from '../../../roborockCommunication/protocol/deserializers/messageDeserializer.js';
import { Protocol } from '../../../roborockCommunication/models/index.js';

describe('MessageDeserializer', () => {
  let logger: any;

  beforeEach(() => {
    logger = { debug: vi.fn(), notice: vi.fn(), error: vi.fn() };
  });

  it('returns ResponseMessage for protocols without payload', () => {
    const context: any = { getLocalKey: () => null, nonce: 0, getDeviceNonce: () => 0 };
    const des = new MessageDeserializer(context, logger as any);

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
    const context: any = { getLocalKey: () => null, nonce: 0, getDeviceNonce: () => 0 };
    const des = new MessageDeserializer(context, logger as any);
    const buf = Buffer.alloc(17);
    buf.write('BAD', 0, 3, 'ascii');
    buf.writeUInt32BE(0, 3);
    buf.writeUInt32BE(0, 7);
    buf.writeUInt32BE(0, 11);
    buf.writeUInt16BE(Protocol.rpc_response, 15);
    expect(() => des.deserialize('duid', buf, 'from')).toThrow(/unknown protocol/);
  });

  it('parses rpc_response and returns a body with parsed dps', async () => {
    const mpf = await import('../../../roborockCommunication/helper/messageProcessorFactory.js');
    vi.spyOn(mpf.MessageProcessorFactory.prototype, 'getMessageProcessor').mockReturnValue({
      decode: (_payload: Buffer) => Buffer.from(JSON.stringify({ dps: { '102': JSON.stringify({ x: 1 }) } })),
    } as any);

    const context: any = { getLocalKey: () => 'local', nonce: 7, getDeviceNonce: () => 9 };
    const des = new MessageDeserializer(context, logger as any);

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
    const body = (res as any).body;
    expect(body).toBeDefined();
    expect(body.data['102']).toBeDefined();
    expect(body.data['102'].x).toBe(1);
  });
});
