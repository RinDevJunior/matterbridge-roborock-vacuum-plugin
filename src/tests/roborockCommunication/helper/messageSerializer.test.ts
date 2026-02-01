import { describe, it, expect, vi, afterEach } from 'vitest';
import { MessageContext, Protocol, RequestMessage, UserData } from '../../../roborockCommunication/models/index.js';
import { asPartial, asType } from '../../helpers/testUtils.js';
import type { AbstractMessageBodyBuilder } from '../../../roborockCommunication/protocol/builders/abstractMessageBodyBuilder.js';
import type { AbstractSerializer } from '../../../roborockCommunication/protocol/serializers/abstractSerializer.js';
import { MessageSerializer } from '../../../roborockCommunication/protocol/serializers/messageSerializer.js';
import { MessageBodyBuilderFactory } from '../../../roborockCommunication/protocol/builders/messageBodyBuilderFactory.js';
import { MessageSerializerFactory } from '../../../roborockCommunication/protocol/serializers/messageSerializerFactory.js';
import { makeLogger } from '../../testUtils.js';

const mkUser = () => asPartial<UserData>({ rriot: { r: { a: 'https://api.example', r: 'r', m: 'm', l: 'l' }, u: 'uid', s: 's', h: 'h', k: 'k' } });

describe('MessageSerializer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws for unknown protocol when version not supported', () => {
    const ctx = new MessageContext(asType<UserData>(mkUser()));
    const serializer = new MessageSerializer(ctx, makeLogger());
    const req = new RequestMessage({ protocol: Protocol.rpc_request, version: undefined });
    expect(() => serializer.serialize('d-missing', req)).toThrow(/unknown protocol/);
  });

  it('throws when no local key for device', () => {
    const ctx = new MessageContext(asType<UserData>(mkUser()));
    // set a supported version on request so it proceeds to localKey lookup
    const serializer = new MessageSerializer(ctx, makeLogger());
    const req = new RequestMessage({ protocol: Protocol.general_request, version: '1.0' });
    expect(() => serializer.serialize('d-no-key', req)).toThrow(/no local key/);
  });

  it('serializes protocols without payload to a minimal message', () => {
    const ctx = new MessageContext(asType<UserData>(mkUser()));
    // provide a protocol version so serializer accepts it
    ctx.registerDevice('duid-hello', 'lk', '1.0', 0);
    const serializer = new MessageSerializer(ctx, makeLogger());
    const req = new RequestMessage({ protocol: Protocol.hello_request, version: '1.0', nonce: 123, timestamp: 456 });
    const res = serializer.serialize('duid-hello', req);
    expect(res).toHaveProperty('messageId');
    expect(res.buffer.length).toBe(23); // header size without payload
  });

  it('uses messageBodyBuilder and processor to encode payload', async () => {
    const ctx = new MessageContext(asPartial<UserData>({ rriot: { r: { a: 'https://api.example', r: 'r', m: 'm', l: 'l' }, u: 'uid', s: 's', h: 'h', k: 'k' } }));
    ctx.registerDevice('duid-ok', 'lk-secret', '1.0', 77);

    // mock the factory methods to return controlled builders/processors
    vi.spyOn(MessageBodyBuilderFactory.prototype, 'getMessageBodyBuilder').mockReturnValue(
      asType<AbstractMessageBodyBuilder>({
        buildPayload: (_req: RequestMessage, _ctx: MessageContext) => 'payload',
      }),
    );

    vi.spyOn(MessageSerializerFactory.prototype, 'getMessageSerializer').mockReturnValue(
      asType<AbstractSerializer>({
        encode: (_payload: string, _localKey: string, _timestamp: number, _seq: number, _nonce: number, _connectNonce?: number, _ackNonce?: number) => Buffer.from([9, 8, 7]),
      }),
    );

    const serializer = new MessageSerializer(ctx, makeLogger());
    const req = new RequestMessage({ protocol: Protocol.general_request, version: '1.0', nonce: 5, timestamp: 1000 });
    const res = serializer.serialize('duid-ok', req);
    expect(res.buffer.length).toBeGreaterThan(23);
    // ensure the encoded payload appears inside the buffer
    expect(res.buffer.includes(Buffer.from([9, 8, 7]))).toBe(true);
  });
});
