import { describe, it, expect } from 'vitest';
import { L01Serializer } from '../../../../roborockCommunication/protocol/serializers/L01Serializer.js';

describe('L01Serializer', () => {
  const serializer = new L01Serializer();
  const localKey = '0123456789abcdef0123456789abcdef';
  const timestamp = 1600000000;
  const sequence = 1;
  const nonce = 2;
  const connectNonce = 3;
  const ackNonce = 4;

  describe('encode', () => {
    it('should throw when connectNonce is missing', () => {
      expect(() => serializer.encode('payload', localKey, timestamp, sequence, nonce, undefined, ackNonce)).toThrow(
        'connectNonce and ackNonce are required for L01 encryption',
      );
    });

    it('should throw when ackNonce is missing', () => {
      expect(() => serializer.encode('payload', localKey, timestamp, sequence, nonce, connectNonce, undefined)).toThrow(
        'connectNonce and ackNonce are required for L01 encryption',
      );
    });

    it('should throw when both nonces are missing', () => {
      expect(() => serializer.encode('payload', localKey, timestamp, sequence, nonce)).toThrow(
        'connectNonce and ackNonce are required for L01 encryption',
      );
    });

    it('should encode payload when all parameters are provided', () => {
      const result = serializer.encode('hello', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(16);
    });

    it('should produce different output for different payloads', () => {
      const result1 = serializer.encode('payload1', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const result2 = serializer.encode('payload2', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(result1).not.toEqual(result2);
    });

    it('should produce different output for different timestamps', () => {
      const result1 = serializer.encode('payload', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const result2 = serializer.encode('payload', localKey, timestamp + 1, sequence, nonce, connectNonce, ackNonce);
      expect(result1).not.toEqual(result2);
    });

    it('should include 16-byte auth tag', () => {
      const payload = 'test payload';
      const result = serializer.encode(payload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(result.length).toBeGreaterThanOrEqual(payload.length + 16);
    });
  });

  describe('decode', () => {
    it('should throw when connectNonce is missing', () => {
      const encoded = serializer.encode('payload', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() => serializer.decode(encoded, localKey, timestamp, sequence, nonce, undefined, ackNonce)).toThrow(
        'connectNonce and ackNonce are required for L01 decryption',
      );
    });

    it('should throw when ackNonce is missing', () => {
      const encoded = serializer.encode('payload', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() => serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, undefined)).toThrow(
        'connectNonce and ackNonce are required for L01 decryption',
      );
    });

    it('should throw when both nonces are missing', () => {
      const encoded = serializer.encode('payload', localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() => serializer.decode(encoded, localKey, timestamp, sequence, nonce)).toThrow(
        'connectNonce and ackNonce are required for L01 decryption',
      );
    });

    it('should decode encoded payload correctly', () => {
      const originalPayload = 'test message';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const decoded = serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(decoded.toString()).toBe(originalPayload);
    });

    it('should handle empty payload', () => {
      const originalPayload = '';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const decoded = serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(decoded.toString()).toBe(originalPayload);
    });

    it('should handle long payload', () => {
      const originalPayload = 'a'.repeat(1000);
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const decoded = serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(decoded.toString()).toBe(originalPayload);
    });

    it('should fail with wrong localKey', () => {
      const originalPayload = 'secret';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() =>
        serializer.decode(
          encoded,
          'wrongkey12345678901234567890123',
          timestamp,
          sequence,
          nonce,
          connectNonce,
          ackNonce,
        ),
      ).toThrow();
    });

    it('should fail with wrong timestamp', () => {
      const originalPayload = 'secret';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() =>
        serializer.decode(encoded, localKey, timestamp + 100, sequence, nonce, connectNonce, ackNonce),
      ).toThrow();
    });

    it('should fail with wrong nonce', () => {
      const originalPayload = 'secret';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(() =>
        serializer.decode(encoded, localKey, timestamp, sequence, nonce + 1, connectNonce, ackNonce),
      ).toThrow();
    });

    it('should fail with tampered ciphertext', () => {
      const originalPayload = 'secret';
      const encoded = serializer.encode(originalPayload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      encoded[0] ^= 1;
      expect(() => serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce)).toThrow();
    });
  });

  describe('round-trip', () => {
    it('should successfully encode and decode JSON payload', () => {
      const payload = JSON.stringify({ command: 'get_status', data: [1, 2, 3] });
      const encoded = serializer.encode(payload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const decoded = serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(decoded.toString()).toBe(payload);
      expect(JSON.parse(decoded.toString())).toEqual({ command: 'get_status', data: [1, 2, 3] });
    });

    it('should handle unicode characters', () => {
      const payload = 'Hello 世界 🤖';
      const encoded = serializer.encode(payload, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      const decoded = serializer.decode(encoded, localKey, timestamp, sequence, nonce, connectNonce, ackNonce);
      expect(decoded.toString()).toBe(payload);
    });
  });
});
