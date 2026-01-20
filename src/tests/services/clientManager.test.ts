import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { ClientManager } from '@/services/index.js';
import { UserData } from '@/roborockCommunication/index.js';

describe('ClientManager', () => {
  let clientManager: ClientManager;
  let mockLogger: AnsiLogger;
  let mockUserData: UserData;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as unknown as AnsiLogger;

    mockUserData = {
      uid: 'test-uid',
      tokentype: 'Bearer',
      token: 'test-token',
      rruid: 'rr-uid',
      rriot: {
        u: 'user-id',
        s: 'session',
        h: 'host',
        k: 'test-key',
      },
    } as unknown as UserData;

    clientManager = new ClientManager(mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should initialize correctly', () => {
      expect(clientManager).toBeDefined();
    });

    it('should create and cache ClientRouter for new user', () => {
      const username = 'test@example.com';

      const result1 = clientManager.get(username, mockUserData);
      const result2 = clientManager.get(username, mockUserData);

      expect(result1).toBeDefined();
      expect(result1).toBe(result2); // Should return same cached instance
    });

    it('should create separate clients for different users', () => {
      const user1 = 'test1@example.com';
      const user2 = 'test2@example.com';

      const client1 = clientManager.get(user1, mockUserData);
      const client2 = clientManager.get(user2, mockUserData);

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      expect(client1).not.toBe(client2);
    });

    it('should handle destroy for specific user', () => {
      const username = 'test@example.com';

      const client = clientManager.get(username, mockUserData);
      expect(client).toBeDefined();

      // Mock the disconnect method
      vi.spyOn(client, 'disconnect').mockResolvedValue(undefined);

      clientManager.destroy(username);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should handle destroyAll', () => {
      const user1 = 'test1@example.com';
      const user2 = 'test2@example.com';

      const client1 = clientManager.get(user1, mockUserData);
      const client2 = clientManager.get(user2, mockUserData);

      // Mock disconnect methods
      vi.spyOn(client1, 'disconnect').mockResolvedValue(undefined);
      vi.spyOn(client2, 'disconnect').mockResolvedValue(undefined);

      clientManager.destroyAll();

      expect(client1.disconnect).toHaveBeenCalled();
      expect(client2.disconnect).toHaveBeenCalled();
    });

    it('should handle edge cases gracefully', () => {
      // Test with empty string
      expect(() => clientManager.get('', mockUserData)).toThrow('Username cannot be empty');

      // Test with whitespace
      expect(() => clientManager.get('  ', mockUserData)).toThrow('Username cannot be empty');

      // Test destroy non-existent user
      expect(() => clientManager.destroy('non-existent')).not.toThrow();
    });
  });
});
