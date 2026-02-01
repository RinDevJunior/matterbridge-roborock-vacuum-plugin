import { describe, it, expect, vi } from 'vitest';
import type { AxiosStatic, AxiosInstance } from 'axios';
import { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import { AuthenticateResponseCode } from '../../../roborockCommunication/enums/index.js';
import { createMockLogger, asPartial, asType, mkUser } from '../../helpers/testUtils.js';

describe('RoborockAuthenticateApi private helpers', () => {
  const logger = createMockLogger();
  const api = new RoborockAuthenticateApi(logger, asPartial<AxiosStatic>({ create: () => asPartial<AxiosInstance>({}) }));

  it('auth throws when userdata missing token', () => {
    expect(() => api['auth']('u', { data: undefined, msg: 'no', code: 0 })).toThrow();
  });

  it('auth sets username and token on success', () => {
    const res = api['auth']('user1', { data: { ...mkUser(), token: 'tok', uid: 'u1' }, msg: '', code: 0 });
    expect(res.token).toBe('tok');
    expect(res.uid).toBe('u1');
    expect(api['username']).toBe('user1');
    expect(api['authToken']).toBe('tok');
  });

  it('authV4 throws on InvalidCode and RateLimited', () => {
    expect(() => api['authV4']('e', { code: AuthenticateResponseCode.InvalidCode, msg: 'x', data: undefined })).toThrow(/Invalid verification code/);
    expect(() => api['authV4']('e', { code: AuthenticateResponseCode.RateLimited, msg: 'x', data: undefined })).toThrow(/Rate limited/);
  });

  it('signKeyV3 returns k or throws when missing', async () => {
    const fakeApi = asPartial<AxiosStatic>({ post: (async (..._args: any[]) => ({ data: { data: { k: 'signed' } } })) as any });
    await expect(api['signKeyV3'](fakeApi, 's')).resolves.toBe('signed');

    const badApi = asPartial<AxiosStatic>({ post: (async (..._args: any[]) => ({ data: { data: {}, msg: 'err' } })) as any });
    await expect(api['signKeyV3'](badApi, 's')).rejects.toThrow(/Failed to sign key/);
  });

  it('getCachedCountryInfo returns cached values', () => {
    api['cachedCountry'] = 'Germany';
    api['cachedCountryCode'] = 'DE';
    const info = api.getCachedCountryInfo();
    expect(info).toEqual({ country: 'Germany', countryCode: 'DE' });
  });

  it('generateRandomString returns string of correct length', () => {
    const result = api['generateRandomString'](10);
    expect(result).toHaveLength(10);
    expect(/^[A-Za-z0-9]+$/.test(result)).toBe(true);
  });

  it('loginWithAuthToken sets username and authToken', () => {
    api['loginWithAuthToken']('testuser', 'token123');
    expect(api['username']).toBe('testuser');
    expect(api['authToken']).toBe('token123');
  });
});
