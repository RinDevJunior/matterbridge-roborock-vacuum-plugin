import { describe, it, expect, vi } from 'vitest';
import { MessageDeserializer } from '../../../roborockCommunication/helper/messageDeserializer';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';
import { AnsiLogger } from 'matterbridge/logger';
import { Protocol } from '../../../roborockCommunication/broadcast/model/protocol';

const mkUser = () => ({ rriot: { k: 'test-key' } }) as any;

function buildHeaderBuffer(version: string, seq: number, nonce: number, timestamp: number, protocol: number): Buffer {
  const buf = Buffer.alloc(3 + 4 + 4 + 4 + 2);
  buf.write(version, 0, 3, 'utf8');
  buf.writeUInt32BE(seq, 3);
  buf.writeUInt32BE(nonce, 7);
  buf.writeUInt32BE(timestamp, 11);
  buf.writeUInt16BE(protocol, 15);
  return buf;
}

describe('MessageDeserializer (basic)', () => {
  it('returns ResponseMessage for protocols without payload', () => {
    const ctx = new MessageContext(mkUser());
    const logger = { notice: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AnsiLogger;
    const d = new MessageDeserializer(ctx, logger);
    const duid = 'DTEST';
    const headerBuf = buildHeaderBuffer('1.0', 1, 2, 3, Protocol.hello_request);
    const resp = d.deserialize(duid, headerBuf);
    expect(resp.duid).toBe(duid);
    expect(resp.header.version).toBe('1.0');
    expect(resp.header.protocol).toBe(Protocol.hello_request);
  });
});
