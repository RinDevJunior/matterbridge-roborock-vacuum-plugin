import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { LocalNetworkUDPClient } from '../../../../roborockCommunication/broadcast/client/LocalNetworkUDPClient.js';
import { AbstractUDPMessageListener } from '../../../../roborockCommunication/broadcast/listener/abstractUDPMessageListener.js';
import crypto from 'node:crypto';
import CRC32 from 'crc-32';
import * as dgram from 'node:dgram';
import { EventEmitter } from 'node:events';

// Mock dgram module
vi.mock('node:dgram', () => {
  return {
    createSocket: vi.fn(),
  };
});

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
    logLevel: 'info',
  } as unknown as AnsiLogger;
}

class MockSocket extends EventEmitter {
  public bind = vi.fn();
  public close = vi.fn((callback?: () => void) => {
    if (callback) callback();
  });
  public send = vi.fn();
}

/**
 * Create a valid V10 protocol buffer with encrypted payload
 */
function createV10Buffer(networkInfo: { duid: string; ssid: string; ip: string; mac: string; bssid: string; rssi: number }): Buffer {
  const plaintext = JSON.stringify(networkInfo);

  // Pad to 16-byte boundary
  const paddingLength = 16 - (plaintext.length % 16);
  const paddedPlaintext = plaintext + String.fromCharCode(paddingLength).repeat(paddingLength);

  // Encrypt using AES-128-ECB
  const key = Buffer.from('qWKYcdQWrbm9hPqe', 'utf8');
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(paddedPlaintext, 'utf8'), cipher.final()]);

  // Build the buffer
  const version = Buffer.from('1.0', 'latin1');
  const seq = Buffer.alloc(4);
  seq.writeUInt32BE(1, 0);
  const protocol = Buffer.alloc(2);
  protocol.writeUInt16BE(102, 0);
  const payloadLen = Buffer.alloc(2);
  payloadLen.writeUInt16BE(encrypted.length, 0);

  const headerAndPayload = Buffer.concat([version, seq, protocol, payloadLen, encrypted]);

  // Calculate CRC32
  const crc = CRC32.buf(headerAndPayload) >>> 0;
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([headerAndPayload, crcBuffer]);
}

/**
 * Create a valid L01 protocol buffer with encrypted payload
 */
function createL01Buffer(networkInfo: { duid: string; ssid: string; ip: string; mac: string; bssid: string; rssi: number }): Buffer {
  const plaintext = JSON.stringify(networkInfo);

  // Build header first (needed for IV generation)
  const version = Buffer.from('L01', 'latin1');
  const field1 = Buffer.from('0000', 'latin1');
  const field2 = Buffer.from('00', 'latin1');

  // Calculate key and IV
  const key = crypto.createHash('sha256').update(Buffer.from('qWKYcdQWrbm9hPqe', 'utf8')).digest();
  const digestInput = Buffer.concat([version, field1, field2]);
  const digest = crypto.createHash('sha256').update(digestInput).digest();
  const iv = digest.subarray(0, 12);

  // Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Payload is ciphertext + auth tag
  const payload = Buffer.concat([encrypted, tag]);

  const payloadLen = Buffer.alloc(2);
  payloadLen.writeUInt16BE(payload.length, 0);

  const headerAndPayload = Buffer.concat([version, field1, field2, payloadLen, payload]);

  // Calculate CRC32
  const crc = CRC32.buf(headerAndPayload) >>> 0;
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([headerAndPayload, crcBuffer]);
}

describe('LocalNetworkUDPClient', () => {
  let client: LocalNetworkUDPClient;
  let mockLogger: AnsiLogger;
  let mockSocket: MockSocket;

  const testNetworkInfo = {
    duid: 'test-duid-123',
    ssid: 'TestNetwork',
    ip: '192.168.1.100',
    mac: 'AA:BB:CC:DD:EE:FF',
    bssid: '11:22:33:44:55:66',
    rssi: -50,
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockSocket = new MockSocket();
    vi.mocked(dgram.createSocket).mockReturnValue(mockSocket as unknown as dgram.Socket);
    client = new LocalNetworkUDPClient(mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with logger', () => {
      expect(client).toBeDefined();
    });
  });

  describe('registerListener', () => {
    it('should register a listener', () => {
      const mockListener: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener);

      // Verify by triggering a message and checking if listener is called
      expect(() => {
        client.registerListener(mockListener);
      }).not.toThrow();
    });

    it('should register multiple listeners', () => {
      const mockListener1: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };
      const mockListener2: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener1);
      client.registerListener(mockListener2);

      expect(() => {
        client.registerListener(mockListener1);
      }).not.toThrow();
    });
  });

  describe('connect', () => {
    it('should create UDP socket and bind to port', () => {
      client.connect();

      expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
      expect(mockSocket.bind).toHaveBeenCalledWith(58866);
    });

    it('should set up message and error event handlers', () => {
      client.connect();

      expect(mockSocket.listenerCount('message')).toBe(1);
      expect(mockSocket.listenerCount('error')).toBe(1);
    });

    it('should handle error when creating socket fails', () => {
      vi.mocked(dgram.createSocket).mockImplementation(() => {
        throw new Error('Socket creation failed');
      });

      client.connect();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create UDP server'));
    });
  });

  describe('disconnect', () => {
    it('should close server when connected', async () => {
      client.connect();

      await client.disconnect();

      expect(mockSocket.close).toHaveBeenCalled();
    });

    it('should resolve immediately when not connected', async () => {
      // Don't call connect
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    it('should handle disconnect after connect', async () => {
      client.connect();
      await client.disconnect();

      // Should be able to disconnect again without error
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('onError', () => {
    it('should log error and close socket', async () => {
      client.connect();

      // Emit error event
      mockSocket.emit('error', new Error('Test error'));

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('UDP socket error'));
      expect(mockSocket.close).toHaveBeenCalled();
    });
  });

  describe('onMessage with V10 protocol', () => {
    it('should deserialize V10 message and notify listeners', async () => {
      const mockListener: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener);
      client.connect();

      const buffer = createV10Buffer(testNetworkInfo);
      mockSocket.emit('message', buffer);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockListener.onMessage).toHaveBeenCalledWith(testNetworkInfo.duid, testNetworkInfo.ip);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received message'));
    });

    it('should notify multiple listeners', async () => {
      const mockListener1: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };
      const mockListener2: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener1);
      client.registerListener(mockListener2);
      client.connect();

      const buffer = createV10Buffer(testNetworkInfo);
      mockSocket.emit('message', buffer);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockListener1.onMessage).toHaveBeenCalledWith(testNetworkInfo.duid, testNetworkInfo.ip);
      expect(mockListener2.onMessage).toHaveBeenCalledWith(testNetworkInfo.duid, testNetworkInfo.ip);
    });
  });

  describe('onMessage with L01 protocol', () => {
    it('should deserialize L01 message and notify listeners', async () => {
      const mockListener: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener);
      client.connect();

      const buffer = createL01Buffer(testNetworkInfo);
      mockSocket.emit('message', buffer);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockListener.onMessage).toHaveBeenCalledWith(testNetworkInfo.duid, testNetworkInfo.ip);
    });
  });

  describe('deserializeMessage error handling', () => {
    it('should throw error for unsupported protocol version', async () => {
      client.connect();

      // Create a buffer with unsupported version
      const unsupportedBuffer = Buffer.from('XYZ0000000000000', 'latin1');

      // We need to catch the error from the async handler
      const originalEmit = mockSocket.emit.bind(mockSocket);
      let caughtError: Error | undefined;

      mockSocket.emit = (event: string, ...args: unknown[]) => {
        if (event === 'message') {
          // Wrap the call to catch async errors
          client.onMessage(args[0] as Buffer).catch((e: unknown) => {
            caughtError = e instanceof Error ? e : new Error(String(e));
          });
          return true;
        }
        return originalEmit(event, ...args);
      };

      mockSocket.emit('message', unsupportedBuffer);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toContain('Unsupported protocol version');
    });

    it('should throw error for invalid V10 CRC32', async () => {
      // Create a valid V10 buffer but corrupt the CRC
      const buffer = createV10Buffer(testNetworkInfo);
      // Corrupt the last byte (part of CRC32)
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xff;

      // Test the private deserializeMessage method directly
      await expect((client as any).deserializeMessage(buffer)).rejects.toThrow('wrong CRC32');
    });

    it('should throw error for invalid L01 CRC32', async () => {
      // Create a valid L01 buffer but corrupt the CRC
      const buffer = createL01Buffer(testNetworkInfo);
      // Corrupt the last byte (part of CRC32)
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xff;

      // Test the private deserializeMessage method directly
      await expect((client as any).deserializeMessage(buffer)).rejects.toThrow('wrong CRC32');
    });
  });

  describe('deserializeV10Message', () => {
    it('should correctly decrypt V10 message payload', async () => {
      const buffer = createV10Buffer(testNetworkInfo);

      // Access private method through any
      const result = await (client as any).deserializeV10Message(buffer);
      const parsed = JSON.parse(result);

      expect(parsed.duid).toBe(testNetworkInfo.duid);
      expect(parsed.ip).toBe(testNetworkInfo.ip);
    });
  });

  describe('deserializeL01Message', () => {
    it('should correctly decrypt L01 message payload', async () => {
      const buffer = createL01Buffer(testNetworkInfo);

      // Access private method through any
      const result = await (client as any).deserializeL01Message(buffer);
      const parsed = JSON.parse(result);

      expect(parsed.duid).toBe(testNetworkInfo.duid);
      expect(parsed.ip).toBe(testNetworkInfo.ip);
    });

    it('should throw error when decryption fails due to invalid auth tag', async () => {
      // Create a buffer with corrupted auth tag
      const buffer = createL01Buffer(testNetworkInfo);

      // Find payload start and corrupt the auth tag (last 16 bytes of payload)
      // Header: version(3) + field1(4) + field2(2) + payloadLen(2) = 11 bytes
      // Then payload, then CRC32(4)
      const payloadLen = buffer.readUInt16BE(9);
      const payloadStart = 11;
      const authTagStart = payloadStart + payloadLen - 16;

      // Corrupt auth tag
      buffer[authTagStart] = buffer[authTagStart] ^ 0xff;

      // Recalculate CRC32 for the corrupted buffer
      const headerAndPayload = buffer.subarray(0, buffer.length - 4);
      const crc = CRC32.buf(headerAndPayload) >>> 0;
      buffer.writeUInt32BE(crc, buffer.length - 4);

      await expect((client as any).deserializeL01Message(buffer)).rejects.toThrow('failed to decrypt');
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid successive messages', async () => {
      const mockListener: AbstractUDPMessageListener = {
        onMessage: vi.fn().mockResolvedValue(undefined),
      };

      client.registerListener(mockListener);
      client.connect();

      const networkInfo1 = { ...testNetworkInfo, duid: 'duid-1', ip: '192.168.1.1' };
      const networkInfo2 = { ...testNetworkInfo, duid: 'duid-2', ip: '192.168.1.2' };
      const networkInfo3 = { ...testNetworkInfo, duid: 'duid-3', ip: '192.168.1.3' };

      mockSocket.emit('message', createV10Buffer(networkInfo1));
      mockSocket.emit('message', createL01Buffer(networkInfo2));
      mockSocket.emit('message', createV10Buffer(networkInfo3));

      // Wait for async handlers
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockListener.onMessage).toHaveBeenCalledTimes(3);
      expect(mockListener.onMessage).toHaveBeenCalledWith('duid-1', '192.168.1.1');
      expect(mockListener.onMessage).toHaveBeenCalledWith('duid-2', '192.168.1.2');
      expect(mockListener.onMessage).toHaveBeenCalledWith('duid-3', '192.168.1.3');
    });
  });
});
