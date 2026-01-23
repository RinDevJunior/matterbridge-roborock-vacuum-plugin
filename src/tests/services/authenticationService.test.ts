import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthenticationService } from '../../services/authenticationService.js';

const mockAuthGateway = {
  requestVerificationCode: vi.fn(),
  authenticate2FA: vi.fn(),
  authenticatePassword: vi.fn(),
  refreshToken: vi.fn(),
};
const mockPersist = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  notice: vi.fn(),
};
const mockConfigManager = {
  alwaysExecuteAuthentication: false,
};

let service: AuthenticationService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new AuthenticationService(mockAuthGateway as any, mockPersist as any, mockLogger as any, mockConfigManager as any);
});

describe('AuthenticationService', () => {
  it('should request verification code', async () => {
    await service.requestVerificationCode('test@example.com');
    expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
  });

  it('should login with verification code and save user data', async () => {
    const userData = { username: 'test@example.com' };
    mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
    const saveUserData = vi.fn().mockResolvedValue(undefined);
    const result = await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
    expect(result).toBe(userData);
    expect(saveUserData).toHaveBeenCalledWith(userData);
  });

  it('should login with cached token', async () => {
    const userData = { username: 'test@example.com' };
    mockAuthGateway.refreshToken.mockResolvedValue(userData);
    const result = await service.loginWithCachedToken('test@example.com', userData as any);
    expect(result).toBe(userData);
    expect(mockAuthGateway.refreshToken).toHaveBeenCalledWith(userData);
  });

  it('should login with password and save user data', async () => {
    const userData = { username: 'test@example.com' };
    mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
    const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
    const saveUserData = vi.fn().mockResolvedValue(undefined);
    const result = await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
    expect(result).toBe(userData);
    expect(mockAuthGateway.authenticatePassword).toHaveBeenCalledWith('test@example.com', 'pw');
    expect(saveUserData).toHaveBeenCalledWith(userData);
  });

  it('should authenticate with password flow', async () => {
    mockPersist.getItem.mockResolvedValue(undefined);
    mockAuthGateway.authenticatePassword.mockResolvedValue({ username: 'test@example.com' });
    mockPersist.setItem.mockResolvedValue(undefined);
    const result = await service.authenticateWithPasswordFlow('test@example.com', 'pw');
    expect(result).toEqual({ username: 'test@example.com' });
    expect(mockPersist.setItem).toHaveBeenCalledWith('userData', { username: 'test@example.com' });
  });

  it('should authenticate 2FA flow and save user data', async () => {
    mockPersist.getItem.mockResolvedValue(undefined);
    mockAuthGateway.authenticate2FA.mockResolvedValue({ username: 'test@example.com' });
    mockPersist.setItem.mockResolvedValue(undefined);
    mockPersist.removeItem.mockResolvedValue(undefined);
    const result = await service.authenticate2FAFlow('test@example.com', '654321');
    expect(result).toEqual({ username: 'test@example.com' });
    expect(mockPersist.setItem).toHaveBeenCalledWith('userData', { username: 'test@example.com' });
    expect(mockPersist.removeItem).toHaveBeenCalledWith('authenticateFlowState');
  });
});
