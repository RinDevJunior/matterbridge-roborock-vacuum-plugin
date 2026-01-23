import { describe, it, expect, vi } from 'vitest';
import { MessageContext, Protocol, RequestMessage } from '../../../roborockCommunication/models/index.js';
import { MessageSerializer } from '../../../roborockCommunication/protocol/serializers/messageSerializer.js';
import { MessageDeserializer } from '../../../roborockCommunication/protocol/deserializers/messageDeserializer.js';

const mkUser = () => ({ rriot: { k: 'some-key-for-test-000' } }) as any;

const logger: any = { error: vi.fn(), notice: vi.fn(), debug: vi.fn() };

describe('MessageSerializer/Deserializer roundtrip', () => {
  it('serializes and deserializes a 1.0 rpc_response payload', () => {
    const userdata = mkUser();
    const ctx = new MessageContext(userdata);
    const duid = 'D1';
    const localKey = '0123456789abcdef';
    ctx.registerDevice(duid, localKey, '1.0', 12345);

    const serializer = new MessageSerializer(ctx, logger);
    const deserializer = new MessageDeserializer(ctx, logger);

    const req = new RequestMessage({ messageId: 54321, protocol: Protocol.rpc_response, nonce: 2222, timestamp: 1600000000 });
    const { buffer } = serializer.serialize(duid, req);

    const resp = deserializer.deserialize(duid, buffer, 'local');
    // should parse dps with key '102' (rpc_response)
    const got = resp.get(Protocol.rpc_response);
    expect(typeof got).toBe('object');
    // id should match the one we set
    expect((got as any).id).toBe(54321);
  });

  it('throws on CRC mismatch', () => {
    const userdata = mkUser();
    const ctx = new MessageContext(userdata);
    const duid = 'D2';
    ctx.registerDevice(duid, '0123456789abcdef', '1.0', 1);

    const serializer = new MessageSerializer(ctx, logger);
    const deserializer = new MessageDeserializer(ctx, logger);
    const req = new RequestMessage({ messageId: 111, protocol: Protocol.rpc_response, nonce: 2, timestamp: 1600000010 });
    const { buffer } = serializer.serialize(duid, req);

    // corrupt a byte before the CRC
    const bad = Buffer.from(buffer);
    bad[10] = (bad[10] + 1) & 0xff;

    expect(() => deserializer.deserialize(duid, bad, 'local')).toThrow(/Wrong CRC32/);
  });

  it('returns empty dps when localKey missing', () => {
    const userdata = mkUser();
    const ctx1 = new MessageContext(userdata);
    const duid = 'D3';
    ctx1.registerDevice(duid, '0123456789abcdef', '1.0', 1);

    const serializer = new MessageSerializer(ctx1, logger);
    const req = new RequestMessage({ messageId: 222, protocol: Protocol.rpc_response, nonce: 3, timestamp: 1600000020 });
    const { buffer } = serializer.serialize(duid, req);

    // create a new context without registering the device
    const ctx2 = new MessageContext(userdata);
    const deserializer = new MessageDeserializer(ctx2, logger);

    const resp = deserializer.deserialize(duid, buffer, 'local');
    // logger.notice should have been called due to missing local key
    expect(logger.notice).toHaveBeenCalled();
    // logger.notice should have been called due to missing local key
    // the returned ResponseMessage currently does not expose a 'dps' key when localKey missing
    expect(resp.get(Protocol.rpc_response)).toBeUndefined();
  });
});
