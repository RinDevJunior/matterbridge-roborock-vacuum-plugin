import { describe, it, expect, vi, afterEach } from 'vitest';
import { MessageContext, Protocol, RequestMessage } from '../../../roborockCommunication/models/index.js';
import { MessageSerializer } from '../../../roborockCommunication/protocol/serializers/messageSerializer.js';

describe('MessageSerializer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws for unknown protocol when version not supported', () => {
    const ctx = new MessageContext({ rriot: { k: 'k' } } as any);
    const serializer = new MessageSerializer(ctx, {} as any);
    const req = new RequestMessage({ protocol: Protocol.rpc_request, version: undefined });
    expect(() => serializer.serialize('d-missing', req)).toThrow(/unknown protocol/);
  });

  it('throws when no local key for device', () => {
    const ctx = new MessageContext({ rriot: { k: 'k' } } as any);
    // set a supported version on request so it proceeds to localKey lookup
    const serializer = new MessageSerializer(ctx, {} as any);
    const req = new RequestMessage({ protocol: Protocol.general_request, version: '1.0' });
    expect(() => serializer.serialize('d-no-key', req)).toThrow(/no local key/);
  });

  it('serializes protocols without payload to a minimal message', () => {
    const ctx = new MessageContext({ rriot: { k: 'k' } } as any);
    // provide a protocol version so serializer accepts it
    ctx.registerDevice('duid-hello', 'lk', '1.0', 0);
    const serializer = new MessageSerializer(ctx, {} as any);
    const req = new RequestMessage({ protocol: Protocol.hello_request, version: '1.0', nonce: 123, timestamp: 456 });
    const res = serializer.serialize('duid-hello', req);
    expect(res).toHaveProperty('messageId');
    expect(res.buffer.length).toBe(23); // header size without payload
  });

  it('uses messageBodyBuilder and processor to encode payload', async () => {
    const ctx = new MessageContext({ rriot: { k: 'k' } } as any);
    ctx.registerDevice('duid-ok', 'lk-secret', '1.0', 77);

    // mock the factory methods to return controlled builders/processors
    const mbf = await import('../../../roborockCommunication/helper/messageBodyBuilderFactory.js');
    const mpf = await import('../../../roborockCommunication/helper/messageProcessorFactory.js');

    vi.spyOn(mbf.MessageBodyBuilderFactory.prototype, 'getMessageBodyBuilder').mockReturnValue({
      buildPayload: (_req: any, _ctx: any) => Buffer.from([1, 2, 3]),
    } as any);

    vi.spyOn(mpf.MessageProcessorFactory.prototype, 'getMessageProcessor').mockReturnValue({
      encode: (_payload: any, _localKey: any, _timestamp: any, _seq: any, _nonce: any, _connectNonce: any, _ackNonce: any) => Buffer.from([9, 8, 7]),
    } as any);

    const serializer = new MessageSerializer(ctx, {} as any);
    const req = new RequestMessage({ protocol: Protocol.general_request, version: '1.0', nonce: 5, timestamp: 1000 });
    const res = serializer.serialize('duid-ok', req);
    expect(res.buffer.length).toBeGreaterThan(23);
    // ensure the encoded payload appears inside the buffer
    expect(res.buffer.includes(Buffer.from([9, 8, 7]))).toBe(true);
  });
});
