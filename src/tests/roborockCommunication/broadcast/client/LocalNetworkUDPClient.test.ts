import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('node:dgram', () => ({
  createSocket: vi.fn(),
}));

vi.mock('binary-parser/dist/binary_parser.js', () => {
  const MockParser = function () {
    return {
      endianness: vi.fn().mockReturnThis(),
      string: vi.fn().mockReturnThis(),
      uint32: vi.fn().mockReturnThis(),
      uint16: vi.fn().mockReturnThis(),
      buffer: vi.fn().mockReturnThis(),
      parse: vi.fn(),
    };
  };
  return {
    Parser: MockParser,
  };
});

vi.mock('node:crypto', () => ({
  default: {
    createDecipheriv: vi.fn(),
    createHash: vi.fn(),
  },
}));

vi.mock('crc-32', () => ({
  default: {
    buf: vi.fn(),
  },
}));

vi.mock('matterbridge/logger', () => ({
  AnsiLogger: vi.fn(),
}));

vi.mock('../../index.js', () => ({
  ProtocolVersion: {
    V1: '1.0',
    L01: 'L01',
  },
  AbstractUDPMessageListener: vi.fn(),
  NetworkInfo: vi.fn(),
}));

import { LocalNetworkUDPClient } from '@/roborockCommunication/broadcast/client/LocalNetworkUDPClient.js';
import * as dgram from 'node:dgram';
import crypto from 'node:crypto';
import CRC32 from 'crc-32';
import { AnsiLogger } from 'matterbridge/logger';

describe('LocalNetworkUDPClient', () => {
  let logger: AnsiLogger;
  let mockSocket: any;
  let mockV10Parser: any;
  let mockL01Parser: any;
  let mockDecipher: any;
  let mockHash: any;

  const createClient = (): LocalNetworkUDPClient => {
    const client = new LocalNetworkUDPClient(logger);
    mockV10Parser = (client as any).V10Parser;
    mockL01Parser = (client as any).L01Parser;
    return client;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as unknown as AnsiLogger;

    mockSocket = {
      bind: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    (dgram.createSocket as any).mockReturnValue(mockSocket);

    mockDecipher = {
      update: vi.fn().mockReturnValue(Buffer.from('decrypted')),
      final: vi.fn().mockReturnValue(Buffer.alloc(0)),
      setAutoPadding: vi.fn(),
      setAuthTag: vi.fn(),
    };

    (crypto.createDecipheriv as any).mockReturnValue(mockDecipher);

    mockHash = {
      update: vi.fn().mockReturnValue(mockHash),
      digest: vi.fn().mockReturnValue(Buffer.from('hash')),
    };

    (crypto.createHash as any).mockReturnValue(mockHash);

    (CRC32.buf as any).mockReturnValue(12345);
  });

  describe('constructor', () => {
    it('should create parsers', () => {
      const client = createClient();
      expect(mockV10Parser).toBeDefined();
      expect(mockL01Parser).toBeDefined();
    });
  });

  describe('registerListener', () => {
    it('should add listener to listeners array', () => {
      const client = createClient();
      const listener = { onMessage: vi.fn() };

      client.registerListener(listener as any);

      expect((client as any).listeners).toContain(listener);
    });
  });

  describe('connect', () => {
    it('should create socket and bind to port', () => {
      const client = createClient();
      client.connect();

      expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
      expect(mockSocket.bind).toHaveBeenCalledWith(58866);
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect((client as any).server).toBe(mockSocket);
    });

    it('should handle socket creation error', () => {
      const client = createClient();
      (dgram.createSocket as any).mockImplementation(() => {
        throw new Error('Socket error');
      });

      client.connect();

      expect(logger.error).toHaveBeenCalledWith('[LocalNetworkUDPClient] Failed to create UDP server: Error: Socket error');
      expect((client as any).server).toBeUndefined();
    });
  });

  describe('disconnect', () => {
    it('should close socket if exists', async () => {
      const client = createClient();
      (client as any).server = mockSocket;
      mockSocket.close.mockImplementation((cb: () => void) => cb());

      await client.disconnect();

      expect(mockSocket.close).toHaveBeenCalled();
      expect((client as any).server).toBeUndefined();
    });

    it('should resolve immediately if no socket', async () => {
      const client = createClient();
      (client as any).server = undefined;

      await client.disconnect();

      expect(mockSocket.close).not.toHaveBeenCalled();
    });
  });

  it('should log error and close socket', async () => {
    const client = createClient();
    (client as any).server = mockSocket;
    mockSocket.close = vi.fn();

    await (client as any).onError(new Error('Test error'));

    expect(logger.error).toHaveBeenCalledWith('[LocalNetworkUDPClient] UDP socket error: Error: Test error');
    expect(mockSocket.close).toHaveBeenCalled();
    expect((client as any).server).toBeUndefined();
  });

  describe('onMessage', () => {
    it('should deserialize message and call listeners', async () => {
      const client = createClient();
      const buffer = Buffer.from('test');
      const message = { duid: 'test-duid', ip: '192.168.1.100' };
      const listener = { onMessage: vi.fn() };

      (client as any).deserializeMessage = vi.fn().mockResolvedValue(message);
      (client as any).listeners = [listener];

      await (client as any).onMessage(buffer);

      expect((client as any).deserializeMessage).toHaveBeenCalledWith(buffer);
      expect(logger.debug).toHaveBeenCalledWith(`[LocalNetworkUDPClient] Received message: ${JSON.stringify(message)}`);
      expect(listener.onMessage).toHaveBeenCalledWith('test-duid', '192.168.1.100');
    });
  });

  describe('deserializeMessage', () => {
    it('should deserialize V1 message', async () => {
      const client = createClient();
      const buffer = Buffer.from('1.0');
      const data = '{"duid":"test","ip":"192.168.1.1"}';

      (client as any).deserializeV10Message = vi.fn().mockResolvedValue(data);

      const result = await (client as any).deserializeMessage(buffer);

      expect((client as any).deserializeV10Message).toHaveBeenCalledWith(buffer);
      expect(result).toEqual(JSON.parse(data));
    });

    it('should deserialize L01 message', async () => {
      const client = createClient();
      const buffer = Buffer.from('L01');
      const data = '{"duid":"test","ip":"192.168.1.1"}';

      (client as any).deserializeL01Message = vi.fn().mockResolvedValue(data);

      const result = await (client as any).deserializeMessage(buffer);

      expect((client as any).deserializeL01Message).toHaveBeenCalledWith(buffer);
      expect(result).toEqual(JSON.parse(data));
    });

    it('should throw error for unsupported version', async () => {
      const client = createClient();
      const buffer = Buffer.from('XXX');

      await expect((client as any).deserializeMessage(buffer)).rejects.toThrow('Unsupported protocol version: XXX');
    });
  });

  describe('deserializeV10Message', () => {
    it('should parse, check CRC, decrypt and return data', async () => {
      const client = createClient();
      const buffer = Buffer.from('test buffer');
      const parsedData = {
        payload: Buffer.from('encrypted'),
        crc32: 12345,
      };
      const decrypted = 'decrypted data\x01';

      mockV10Parser.parse.mockReturnValue(parsedData);
      (CRC32.buf as any).mockReturnValue(12345);
      mockDecipher.update.mockReturnValue('decrypted data\x01');
      mockDecipher.final.mockReturnValue('');

      const result = await (client as any).deserializeV10Message(buffer);

      expect(mockV10Parser.parse).toHaveBeenCalledWith(buffer);
      expect(CRC32.buf).toHaveBeenCalledWith(buffer.subarray(0, buffer.length - 4));
      expect(crypto.createDecipheriv).toHaveBeenCalledWith('aes-128-ecb', Buffer.from('qWKYcdQWrbm9hPqe', 'utf8'), null);
      expect(mockDecipher.setAutoPadding).toHaveBeenCalledWith(false);
      expect(mockDecipher.update).toHaveBeenCalledWith(parsedData.payload, 'binary', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
      expect(result).toBe('decrypted data');
    });

    it('should throw error on CRC mismatch', async () => {
      const client = createClient();
      const buffer = Buffer.from('test buffer');
      const parsedData = {
        crc32: 12345,
      };

      mockV10Parser.parse.mockReturnValue(parsedData);
      (CRC32.buf as any).mockReturnValue(99999);

      await expect((client as any).deserializeV10Message(buffer)).rejects.toThrow('wrong CRC32: 99999, expect: 12345');
    });
  });

  describe('deserializeL01Message', () => {
    it('should parse, check CRC, decrypt and return data', async () => {
      const client = createClient();
      const buffer = Buffer.from('L01test');
      const parsedData = {
        payload: Buffer.concat([Buffer.from('ciphertext'), Buffer.from('tag'.repeat(4))]),
        crc32: 12345,
      };
      const decrypted = 'decrypted data';

      mockL01Parser.parse.mockReturnValue(parsedData);
      (CRC32.buf as any).mockReturnValue(12345);
      mockHash.digest.mockReturnValue(Buffer.from('digest'.repeat(8)));
      (crypto.createDecipheriv as any).mockReturnValue(mockDecipher);
      mockDecipher.setAuthTag = vi.fn();
      mockDecipher.update.mockReturnValue(Buffer.from('decrypted data'));
      mockDecipher.final.mockReturnValue(Buffer.from(''));

      const result = await (client as any).deserializeL01Message(buffer);

      expect(mockL01Parser.parse).toHaveBeenCalledWith(buffer);
      expect(CRC32.buf).toHaveBeenCalledWith(buffer.subarray(0, buffer.length - 4));
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith(Buffer.from('qWKYcdQWrbm9hPqe', 'utf8'));
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith(buffer.subarray(0, 9));
      expect(crypto.createDecipheriv).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer));
      expect(mockDecipher.setAuthTag).toHaveBeenCalled();
      expect(mockDecipher.update).toHaveBeenCalled();
      expect(mockDecipher.final).toHaveBeenCalled();
      expect(result).toBe('decrypted data');
    });

    it('should throw error on CRC mismatch', async () => {
      const client = createClient();
      const buffer = Buffer.from('L01test');
      const parsedData = {
        crc32: 12345,
      };

      mockL01Parser.parse.mockReturnValue(parsedData);
      (CRC32.buf as any).mockReturnValue(99999);

      await expect((client as any).deserializeL01Message(buffer)).rejects.toThrow('wrong CRC32: 99999, expect: 12345');
    });

    it('should throw error on decryption failure', async () => {
      const client = createClient();
      const buffer = Buffer.from('L01test');
      const parsedData = {
        payload: Buffer.concat([Buffer.from('ciphertext'), Buffer.from('tag'.repeat(4))]),
        crc32: 12345,
      };

      mockL01Parser.parse.mockReturnValue(parsedData);
      (CRC32.buf as any).mockReturnValue(12345);
      mockHash.digest.mockReturnValue(Buffer.from('digest'.repeat(8)));
      (crypto.createDecipheriv as any).mockReturnValue(mockDecipher);
      mockDecipher.update.mockImplementation(() => {
        throw new Error('Decryption error');
      });

      await expect((client as any).deserializeL01Message(buffer)).rejects.toThrow('failed to decrypt: Decryption error');
    });
  });
});
