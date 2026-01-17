import { describe, it, expect } from 'vitest';
import { L01Serializer } from '../../../roborockCommunication/serializer/L01Serializer';

describe('L01Serializer', () => {
  it('throws when connectNonce or ackNonce missing', () => {
    const s = new L01Serializer();
    expect(() => s.encode('payload', 'localKey', 1, 1, 1)).toThrow(/connectNonce and ackNonce are required/);
  });

  it('encodes payload when nonces are provided', () => {
    const s = new L01Serializer();
    const buf = s.encode('hello', '0123456789abcdef0123456789abcdef', 1600000000, 1, 2, 3, 4);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
