import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import ClientManager from '../../services/clientManager.js';
import { UserData } from '../../roborockCommunication/models/index.js';
import { makeLogger } from '../testUtils.js';

describe('ClientManager', () => {
  let clientManager: ClientManager;
  let mockLogger: AnsiLogger;
  let mockUserData: UserData;

  beforeEach(() => {
    mockLogger = makeLogger();

    mockUserData = {
      username: 'test-user',
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
    } as UserData;

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
      const result1 = clientManager.get(mockUserData);
      const result2 = clientManager.get(mockUserData);

      expect(result1).toBeDefined();
      expect(result1).toBe(result2); // Should return same cached instance
    });

    it('should create separate clients for different users', () => {
      const user1 = 'test1@example.com';
      const user2 = 'test2@example.com';

      const client1 = clientManager.get({ ...mockUserData, username: user1 });
      const client2 = clientManager.get({ ...mockUserData, username: user2 });

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      expect(client1).not.toBe(client2);
    });

    it('should handle destroy for specific user', () => {
      const username = 'test@example.com';

      const client = clientManager.get({ ...mockUserData, username });
      expect(client).toBeDefined();

      // Mock the disconnect method
      vi.spyOn(client, 'disconnect').mockResolvedValue(undefined);

      clientManager.destroy(username);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should handle destroyAll', () => {
      const user1 = 'test1@example.com';
      const user2 = 'test2@example.com';

      const client1 = clientManager.get({ ...mockUserData, username: user1 });
      const client2 = clientManager.get({ ...mockUserData, username: user2 });

      // Mock disconnect methods
      vi.spyOn(client1, 'disconnect').mockResolvedValue(undefined);
      vi.spyOn(client2, 'disconnect').mockResolvedValue(undefined);

      clientManager.destroyAll();

      expect(client1.disconnect).toHaveBeenCalled();
      expect(client2.disconnect).toHaveBeenCalled();
    });

    it('should handle edge cases gracefully', () => {
      // Test with empty string
      expect(() => clientManager.get({ ...mockUserData, username: '' })).toThrow('Username cannot be empty');

      // Test with whitespace
      expect(() => clientManager.get({ ...mockUserData, username: '  ' })).toThrow('Username cannot be empty');

      // Test destroy non-existent user
      expect(() => {
        clientManager.destroy('non-existent');
      }).not.toThrow();
    });
  });
});
