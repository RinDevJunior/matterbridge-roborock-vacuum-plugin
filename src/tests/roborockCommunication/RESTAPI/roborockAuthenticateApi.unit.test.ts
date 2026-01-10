import { RoborockAuthenticateApi } from '../../../roborockCommunication/RESTAPI/roborockAuthenticateApi';
import { AuthenticateResponseCode } from '../../../roborockCommunication/Zenum/authenticateResponseCode';

describe('RoborockAuthenticateApi private helpers', () => {
  const logger = { debug: jest.fn() } as any;
  const api = new RoborockAuthenticateApi(logger, { create: () => ({}) } as any);

  test('auth throws when userdata missing token', () => {
    expect(() => (api as any).auth('u', { data: undefined, msg: 'no', code: 0 })).toThrow();
  });

  test('auth sets username and token on success', () => {
    const userdata = { token: 'tok', uid: 'u1' };
    const res = (api as any).auth('user1', { data: userdata, msg: '', code: 0 });
    expect(res).toBe(userdata);
    expect((api as any).username).toBe('user1');
    expect((api as any).authToken).toBe('tok');
  });

  test('authV4 throws on InvalidCode and RateLimited', () => {
    expect(() => (api as any).authV4('e', { code: AuthenticateResponseCode.InvalidCode, msg: 'x', data: undefined })).toThrow(/Invalid verification code/);
    expect(() => (api as any).authV4('e', { code: AuthenticateResponseCode.RateLimited, msg: 'x', data: undefined })).toThrow(/Rate limited/);
  });

  test('signKeyV3 returns k or throws when missing', async () => {
    const fakeApi = { post: async () => ({ data: { data: { k: 'signed' } } }) } as any;
    await expect((api as any).signKeyV3(fakeApi, 's')).resolves.toBe('signed');

    const badApi = { post: async () => ({ data: { data: {}, msg: 'err' } }) } as any;
    await expect((api as any).signKeyV3(badApi, 's')).rejects.toThrow(/Failed to sign key/);
  });

  test('getCachedCountryInfo returns cached values', () => {
    (api as any).cachedCountry = 'Germany';
    (api as any).cachedCountryCode = 'DE';
    const info = api.getCachedCountryInfo();
    expect(info).toEqual({ country: 'Germany', countryCode: 'DE' });
  });

  test('generateRandomString returns string of correct length', () => {
    const result = (api as any).generateRandomString(10);
    expect(result).toHaveLength(10);
    expect(/^[A-Za-z0-9]+$/.test(result)).toBe(true);
  });

  test('loginWithAuthToken sets username and authToken', () => {
    (api as any).loginWithAuthToken('testuser', 'token123');
    expect((api as any).username).toBe('testuser');
    expect((api as any).authToken).toBe('token123');
  });
});
