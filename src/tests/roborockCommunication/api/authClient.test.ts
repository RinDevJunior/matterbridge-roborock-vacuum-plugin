import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
describe('RoborockAuthenticateApi', () => {
  let mockLogger: any;
  let mockAxiosFactory: any;
  let mockAxiosInstance: any;
  let api: any;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), notice: vi.fn() };
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    };
    mockAxiosFactory = {
      create: vi.fn(() => mockAxiosInstance),
    };
    api = new RoborockAuthenticateApi(mockLogger, mockAxiosFactory);
  });

  it('loginWithUserData should call loginWithAuthToken and return userData', async () => {
    const spy = vi.spyOn(api, 'loginWithAuthToken');
    const userData = { token: 'abc', other: 'data' };
    const result = await api.loginWithUserData('user', userData);
    expect(spy).toHaveBeenCalledWith('user', 'abc');
    expect(result).toBe(userData);
  });

  it('loginWithPassword should call auth and return userData', async () => {
    const userData = { token: 'tok', other: 'data' };
    const response = { data: { data: userData } };
    vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue(response);
    vi.spyOn(api, 'auth').mockReturnValue(userData);

    const result = await api.loginWithPassword('user', 'pass');
    expect(result).toBe(userData);
    expect(mockAxiosInstance.post).toHaveBeenCalled();
    expect(api.getAPIFor).toHaveBeenCalledWith('user');
    expect(api.auth).toHaveBeenCalledWith('user', response.data);
  });

  it('loginWithPassword should throw error if token missing', async () => {
    const response = { data: { data: null, msg: 'fail', code: 401 } };
    vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue(response);
    vi.spyOn(api, 'auth').mockImplementation(() => {
      throw new Error('Authentication failed: fail code: 401');
    });

    await expect(api.loginWithPassword('user', 'pass')).rejects.toThrow('Authentication failed: fail code: 401');
  });

  it('getHomeDetails should return undefined if username/authToken missing', async () => {
    api.username = undefined;
    api.authToken = undefined;
    const result = await api.getHomeDetails();
    expect(result).toBeUndefined();
  });

  it('getHomeDetails should throw error if response.data missing', async () => {
    api.username = 'user';
    api.authToken = 'tok';
    vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.get.mockResolvedValue({ data: { data: null } });

    await expect(api.getHomeDetails()).rejects.toThrow('Failed to retrieve the home details');
  });

  it('getHomeDetails should return HomeInfo if present', async () => {
    api.username = 'user';
    api.authToken = 'tok';
    const homeInfo = { home: 'info' };
    vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.get.mockResolvedValue({ data: { data: homeInfo } });

    const result = await api.getHomeDetails();
    expect(result).toBe(homeInfo);
  });

  it('getBaseUrl should throw error if response.data missing', async () => {
    vi.spyOn(api, 'apiForUser').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue({ data: { data: null, msg: 'fail' } });

    await expect(api.getBaseUrl('user')).rejects.toThrow('Failed to retrieve base URL: fail');
  });

  it('getBaseUrl should return url if present', async () => {
    vi.spyOn(api, 'apiForUser').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue({ data: { data: { url: 'http://base.url' } } });

    const result = await api.getBaseUrl('user');
    expect(result).toBe('http://base.url');
  });

  it('apiForUser should create AxiosInstance with correct headers', async () => {
    const username = 'user';
    const baseUrl = 'http://base.url';
    const spy = vi.spyOn(mockAxiosFactory, 'create');
    await api.apiForUser(username, baseUrl);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: baseUrl,
        headers: expect.objectContaining({
          header_clientid: expect.any(String),
          Authorization: undefined,
        }),
      }),
    );
  });

  it('auth should call loginWithAuthToken and return userData', () => {
    const spy = vi.spyOn(api, 'loginWithAuthToken');
    const response = { data: { token: 'tok', other: 'data' }, msg: '', code: 0 };
    const result = api.auth('user', response);
    expect(spy).toHaveBeenCalledWith('user', 'tok');
    expect(result).toBe(response.data);
  });

  it('auth should throw error if token missing', () => {
    const response = { data: null, msg: 'fail', code: 401 };
    expect(() => api.auth('user', response)).toThrow('Authentication failed: fail code: 401');
  });

  it('loginWithAuthToken should set username and authToken', () => {
    api.loginWithAuthToken('user', 'tok');
    expect(api.username).toBe('user');
    expect(api.authToken).toBe('tok');
  });

  describe('requestCodeV4', () => {
    it('should successfully request verification code', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      mockAxiosInstance.post.mockResolvedValue({ data: { code: 200 } });

      await api.requestCodeV4('test@example.com');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'api/v4/email/code/send',
        expect.any(URLSearchParams),
        expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Verification code requested successfully');
    });

    it('should throw error if account not found', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      mockAxiosInstance.post.mockResolvedValue({ data: { code: 2008 } }); // AccountNotFound

      await expect(api.requestCodeV4('notfound@example.com')).rejects.toThrow('Account not found for email');
    });

    it('should throw error if rate limited', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      mockAxiosInstance.post.mockResolvedValue({ data: { code: 9002 } }); // RateLimited

      await expect(api.requestCodeV4('rate@example.com')).rejects.toThrow('Rate limited');
    });

    it('should throw error for other failures', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      mockAxiosInstance.post.mockResolvedValue({ data: { code: 500, msg: 'Server error' } });

      await expect(api.requestCodeV4('fail@example.com')).rejects.toThrow('Failed to send verification code');
    });
  });

  describe('loginWithCodeV4', () => {
    it('should successfully login with code', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('1234567890abcdef');

      const signedKey = 'signedKey123';
      const userData = { token: 'userToken', rriot: {} };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { data: { k: signedKey }, code: 200 } }) // signKeyV3
        .mockResolvedValueOnce({ data: { data: userData, code: 200 } }); // actual login

      vi.spyOn(api, 'auth').mockReturnValue(userData);

      const result = await api.loginWithCodeV4('test@example.com', '123456');
      expect(result).toBe(userData);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should throw error when authentication returns no user data', async () => {
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('1234567890abcdef');

      const signedKey = 'signedKey123';

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { data: { k: signedKey }, code: 200 } }) // signKeyV3
        .mockResolvedValueOnce({ data: { data: null, code: 500, msg: 'Server error' } }); // login fails

      await expect(api.loginWithCodeV4('test@example.com', '123456')).rejects.toThrow('Authentication failed: Server error code: 500');
    });
  });

  describe('Country fallback logic', () => {
    it('should use fallback for euiot when country/countryCode not cached', async () => {
      api.cachedCountry = undefined;
      api.cachedCountryCode = undefined;
      api.baseUrl = 'https://euiot.example.com';

      vi.spyOn(api, 'signKeyV3').mockResolvedValue('signedKey');
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('randStr');

      const userData = { token: 'tok', rriot: {} };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: userData, code: 200 } });
      vi.spyOn(api, 'authV4').mockReturnValue(userData);

      await api.loginWithCodeV4('test@example.com', '123456');

      // The request should include fallback country 'Germany' and countryCode 'DE' in params
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'api/v4/auth/email/login/code',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            country: 'Germany',
            countryCode: 'DE',
          }),
        }),
      );
    });

    it('should use fallback for usiot when country/countryCode not cached', async () => {
      api.cachedCountry = undefined;
      api.cachedCountryCode = undefined;
      api.baseUrl = 'https://usiot.example.com';

      vi.spyOn(api, 'signKeyV3').mockResolvedValue('signedKey');
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('randStr');

      const userData = { token: 'tok', rriot: {} };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: userData, code: 200 } });
      vi.spyOn(api, 'authV4').mockReturnValue(userData);

      await api.loginWithCodeV4('test@example.com', '123456');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'api/v4/auth/email/login/code',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            country: 'United States',
            countryCode: 'US',
          }),
        }),
      );
    });

    it('should use fallback for cniot when country/countryCode not cached', async () => {
      api.cachedCountry = undefined;
      api.cachedCountryCode = undefined;
      api.baseUrl = 'https://cniot.example.com';

      vi.spyOn(api, 'signKeyV3').mockResolvedValue('signedKey');
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('randStr');

      const userData = { token: 'tok', rriot: {} };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: userData, code: 200 } });
      vi.spyOn(api, 'authV4').mockReturnValue(userData);

      await api.loginWithCodeV4('test@example.com', '123456');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'api/v4/auth/email/login/code',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            country: 'China',
            countryCode: 'CN',
          }),
        }),
      );
    });

    it('should use fallback for ruiot when country/countryCode not cached', async () => {
      api.cachedCountry = undefined;
      api.cachedCountryCode = undefined;
      api.baseUrl = 'https://ruiot.example.com';

      vi.spyOn(api, 'signKeyV3').mockResolvedValue('signedKey');
      vi.spyOn(api, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
      vi.spyOn(api, 'generateRandomString').mockReturnValue('randStr');

      const userData = { token: 'tok', rriot: {} };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: userData, code: 200 } });
      vi.spyOn(api, 'authV4').mockReturnValue(userData);

      await api.loginWithCodeV4('test@example.com', '123456');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'api/v4/auth/email/login/code',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            country: 'Russia',
            countryCode: 'RU',
          }),
        }),
      );
    });
  });

  describe('Interceptor logging', () => {
    it('should log request and response via interceptors', async () => {
      // Call apiForUser to trigger interceptor setup
      await api.apiForUser('user', 'http://test.com');

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

      // Test request interceptor
      const config = {
        baseURL: 'http://test.com',
        url: '/api/test',
        method: 'POST',
        params: { key: 'value' },
        data: { foo: 'bar' },
        headers: { 'Content-Type': 'application/json' },
      };
      const result = requestInterceptor(config);
      expect(result).toBe(config);
      expect(mockLogger.debug).toHaveBeenCalledWith('=== HTTP Request ===');
      expect(mockLogger.debug).toHaveBeenCalledWith('URL: http://test.com//api/test');

      // Test response interceptor
      const response = {
        status: 200,
        data: { success: true },
      };
      const responseResult = responseInterceptor(response);
      expect(responseResult).toBe(response);
      expect(mockLogger.debug).toHaveBeenCalledWith('=== HTTP Response ===');
      expect(mockLogger.debug).toHaveBeenCalledWith('Status: 200');
    });

    it('should log error via error interceptor', async () => {
      // Call apiForUser to trigger interceptor setup
      await api.apiForUser('user', 'http://test.com');

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = new Error('Request failed');
      (error as any).response = {
        data: { error: 'test error' },
      };

      await expect(errorInterceptor(error)).rejects.toBeInstanceOf(Error);
      await expect(errorInterceptor(error)).rejects.toThrow('Request failed');
      expect(mockLogger.debug).toHaveBeenCalledWith('=== HTTP Error ===');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('test error'));
    });

    it('should log error message when response is missing', async () => {
      // Call apiForUser to trigger interceptor setup
      await api.apiForUser('user', 'http://test.com');

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = new Error('Network error');

      await expect(errorInterceptor(error)).rejects.toBeInstanceOf(Error);
      await expect(errorInterceptor(error)).rejects.toThrow('Network error');
      expect(mockLogger.debug).toHaveBeenCalledWith('=== HTTP Error ===');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });
  });

  describe('getBaseUrl caching', () => {
    it('should return cached baseUrl when username matches', async () => {
      api.cachedBaseUrl = 'http://cached.url';
      api.username = 'user123';

      const result = await api.getBaseUrl('user123');
      expect(result).toBe('http://cached.url');
      // Verify apiForUser was not called
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });
  });

  describe('getAPIFor', () => {
    it('should call getBaseUrl and apiForUser', async () => {
      vi.spyOn(api, 'getBaseUrl').mockResolvedValue('http://test.url');
      vi.spyOn(api, 'apiForUser').mockResolvedValue(mockAxiosInstance);

      const result = await api.getAPIFor('user');
      expect(result).toBe(mockAxiosInstance);
      expect(api.getBaseUrl).toHaveBeenCalledWith('user');
      expect(api.apiForUser).toHaveBeenCalledWith('user', 'http://test.url');
    });
  });
});
