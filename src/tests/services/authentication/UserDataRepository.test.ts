import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { UserDataRepository } from '../../../services/authentication/UserDataRepository.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { createMockLogger, asPartial } from '../../testUtils.js';
import type NodePersist from 'node-persist';
import { AuthenticationConfiguration, RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';

describe('UserDataRepository', () => {
  let repository: UserDataRepository;
  let mockPersist: NodePersist.LocalStorage;
  let mockConfigManager: PlatformConfigManager;
  let mockLogger: AnsiLogger;

  const mockUserData: UserData = {
    username: 'test@example.com',
    uid: 'user123',
    tokentype: 'Bearer',
    token: 'valid-token',
    rruid: 'rr123',
    region: 'US',
    countrycode: 'US',
    country: 'United States',
    nickname: 'Test User',
    rriot: {
      u: 'iot-user',
      s: 'iot-secret',
      h: 'iot-host',
      k: 'iot-key',
      r: {
        r: 'region',
        a: 'auth',
        m: 'mqtt',
        l: 'local',
      },
    },
  };

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockPersist = asPartial<NodePersist.LocalStorage>({
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const mockRawConfig = asPartial<RoborockPluginPlatformConfig>({
      authentication: asPartial<AuthenticationConfiguration>({
        region: 'US',
      }),
    });

    mockConfigManager = asPartial<PlatformConfigManager>({
      get rawConfig() {
        return mockRawConfig;
      },
      get region() {
        const configRegion = mockRawConfig.authentication.region;
        return configRegion?.toUpperCase() ?? 'US';
      },
    });

    repository = new UserDataRepository(mockPersist, mockConfigManager, mockLogger);

    vi.clearAllMocks();
  });

  describe('loadUserData', () => {
    it('should return undefined when no saved data exists', async () => {
      vi.mocked(mockPersist.getItem).mockResolvedValue(undefined);

      const result = await repository.loadUserData('test@example.com');

      expect(mockPersist.getItem).toHaveBeenCalledWith('userData');
      expect(mockLogger.debug).toHaveBeenCalledWith('No saved userData found');
      expect(result).toBeUndefined();
    });

    it('should return undefined and clear when saved username is undefined', async () => {
      const invalidUserData = { ...mockUserData, username: undefined as unknown as string };
      vi.mocked(mockPersist.getItem).mockResolvedValue(invalidUserData);
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Saved userData username does not match, ignoring saved data');
      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should return undefined and clear when saved username is empty string', async () => {
      const invalidUserData = { ...mockUserData, username: '' };
      vi.mocked(mockPersist.getItem).mockResolvedValue(invalidUserData);
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Saved userData username does not match, ignoring saved data');
      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should return undefined and clear when saved username does not match', async () => {
      const invalidUserData = { ...mockUserData, username: 'different@example.com' };
      vi.mocked(mockPersist.getItem).mockResolvedValue(invalidUserData);
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Saved userData username does not match, ignoring saved data');
      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should return undefined and clear when saved region does not match config region', async () => {
      const invalidUserData = { ...mockUserData, region: 'EU' };
      vi.mocked(mockPersist.getItem).mockResolvedValue(invalidUserData);
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Saved userData region does not match current config, ignoring saved data');
      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should perform case-insensitive region comparison', async () => {
      const lowerCaseRegionUserData = { ...mockUserData, region: 'us' };
      vi.mocked(mockPersist.getItem).mockResolvedValue(lowerCaseRegionUserData);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Loading saved userData');
      expect(result).toEqual(lowerCaseRegionUserData);
    });

    it('should perform case-insensitive region comparison with mixed case', async () => {
      const mixedCaseRegionUserData = { ...mockUserData, region: 'Us' };
      vi.mocked(mockPersist.getItem).mockResolvedValue(mixedCaseRegionUserData);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Loading saved userData');
      expect(result).toEqual(mixedCaseRegionUserData);
    });

    it('should successfully load user data when all validations pass', async () => {
      vi.mocked(mockPersist.getItem).mockResolvedValue(mockUserData);

      const result = await repository.loadUserData('test@example.com');

      expect(mockPersist.getItem).toHaveBeenCalledWith('userData');
      expect(mockLogger.debug).toHaveBeenCalledWith('Loading saved userData');
      expect(result).toEqual(mockUserData);
    });

    it('should validate username matches the requested username', async () => {
      vi.mocked(mockPersist.getItem).mockResolvedValue(mockUserData);

      const result = await repository.loadUserData('test@example.com');

      expect(result?.username).toBe('test@example.com');
    });

    it('should validate region against config manager region', async () => {
      const euUserData = { ...mockUserData, region: 'EU' };
      mockConfigManager.rawConfig.authentication.region = 'EU';
      vi.mocked(mockPersist.getItem).mockResolvedValue(euUserData);

      const result = await repository.loadUserData('test@example.com');

      expect(mockLogger.debug).toHaveBeenCalledWith('Loading saved userData');
      expect(result).toEqual(euUserData);
    });
  });

  describe('saveUserData', () => {
    it('should save user data to persist', async () => {
      vi.mocked(mockPersist.setItem).mockResolvedValue(undefined as never);

      await repository.saveUserData(mockUserData);

      expect(mockPersist.setItem).toHaveBeenCalledWith('userData', mockUserData);
      expect(mockLogger.debug).toHaveBeenCalledWith('User data saved successfully');
    });

    it('should save complete user data object', async () => {
      vi.mocked(mockPersist.setItem).mockResolvedValue(undefined as never);

      await repository.saveUserData(mockUserData);

      expect(mockPersist.setItem).toHaveBeenCalledWith(
        'userData',
        expect.objectContaining({
          username: 'test@example.com',
          token: 'valid-token',
          region: 'US',
        }),
      );
    });

    it('should propagate persist errors', async () => {
      const error = new Error('Persist error');
      vi.mocked(mockPersist.setItem).mockRejectedValue(error);

      await expect(repository.saveUserData(mockUserData)).rejects.toThrow('Persist error');
    });
  });

  describe('clearUserData', () => {
    it('should remove user data from persist', async () => {
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      await repository.clearUserData();

      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
    });

    it('should propagate persist errors', async () => {
      const error = new Error('Remove error');
      vi.mocked(mockPersist.removeItem).mockRejectedValue(error);

      await expect(repository.clearUserData()).rejects.toThrow('Remove error');
    });
  });

  describe('integration scenarios', () => {
    it('should clear and reload when username changes', async () => {
      vi.mocked(mockPersist.getItem).mockResolvedValue({ ...mockUserData, username: 'old@example.com' });
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('new@example.com');

      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should clear and reload when region changes', async () => {
      mockConfigManager.rawConfig.authentication.region = 'EU';
      vi.mocked(mockPersist.getItem).mockResolvedValue({ ...mockUserData, region: 'US' });
      vi.mocked(mockPersist.removeItem).mockResolvedValue(undefined as never);

      const result = await repository.loadUserData('test@example.com');

      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(result).toBeUndefined();
    });

    it('should save and load user data successfully', async () => {
      vi.mocked(mockPersist.setItem).mockResolvedValue(undefined as never);
      vi.mocked(mockPersist.getItem).mockResolvedValue(mockUserData);

      await repository.saveUserData(mockUserData);
      const result = await repository.loadUserData('test@example.com');

      expect(mockPersist.setItem).toHaveBeenCalledWith('userData', mockUserData);
      expect(mockPersist.getItem).toHaveBeenCalledWith('userData');
      expect(result).toEqual(mockUserData);
    });
  });
});
