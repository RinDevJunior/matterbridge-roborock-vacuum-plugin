import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  md5hex,
  md5bin,
  encodeTimestamp,
  SALT,
  decryptECB,
} from '../../../roborockCommunication/helper/cryptoHelper.js';

describe('cryptoHelper', () => {
  it('computes md5 hex and binary consistently', () => {
    const s = 'abc';
    expect(md5hex(s)).toBe('900150983cd24fb0d6963f7d28e17f72');
    const bin = md5bin(s);
    expect(bin).toBeInstanceOf(Buffer);
    expect(bin.toString('hex')).toBe(md5hex(s));
  });

  it('encodeTimestamp returns zeros for timestamp 0', () => {
    expect(encodeTimestamp(0)).toBe('00000000');
  });

  it('exports SALT constant', () => {
    expect(typeof SALT).toBe('string');
    expect(SALT.length).toBeGreaterThan(0);
  });

  it('decryptECB removes padding and returns original plaintext', () => {
    const key = Buffer.from('0123456789abcdef');
    const plaintext = 'HELLO';
    const paddingLen = 16 - (plaintext.length % 16);
    const padded = plaintext + String.fromCharCode(paddingLen).repeat(paddingLen);
    const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
    cipher.setAutoPadding(false);
    let encrypted = cipher.update(padded, 'utf8', 'binary');
    encrypted += cipher.final('binary');

    const decrypted = decryptECB(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });
});
