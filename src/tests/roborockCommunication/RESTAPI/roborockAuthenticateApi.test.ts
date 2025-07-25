import { RoborockAuthenticateApi } from '../../../roborockCommunication/RESTAPI/roborockAuthenticateApi';

describe('RoborockAuthenticateApi', () => {
  let mockLogger: any;
  let mockAxiosFactory: any;
  let mockAxiosInstance: any;
  let api: any;

  beforeEach(() => {
    mockLogger = { info: jest.fn(), error: jest.fn() };
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };
    mockAxiosFactory = {
      create: jest.fn(() => mockAxiosInstance),
    };
    api = new RoborockAuthenticateApi(mockLogger, mockAxiosFactory);
  });

  it('should initialize deviceId, logger, axiosFactory', () => {
    expect(api.logger).toBe(mockLogger);
    expect(api.axiosFactory).toBe(mockAxiosFactory);
    expect(typeof api['deviceId']).toBe('string');
  });

  it('loginWithUserData should call loginWithAuthToken and return userData', async () => {
    const spy = jest.spyOn(api as any, 'loginWithAuthToken');
    const userData = { token: 'abc', other: 'data' };
    const result = await api.loginWithUserData('user', userData);
    expect(spy).toHaveBeenCalledWith('user', 'abc');
    expect(result).toBe(userData);
  });

  it('loginWithPassword should call auth and return userData', async () => {
    const userData = { token: 'tok', other: 'data' };
    const response = { data: { data: userData } };
    jest.spyOn(api as any, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue(response);
    jest.spyOn(api as any, 'auth').mockReturnValue(userData);

    const result = await api.loginWithPassword('user', 'pass');
    expect(result).toBe(userData);
    expect(mockAxiosInstance.post).toHaveBeenCalled();
    expect(api['getAPIFor']).toHaveBeenCalledWith('user');
    expect(api['auth']).toHaveBeenCalledWith('user', response.data);
  });

  it('loginWithPassword should throw error if token missing', async () => {
    const response = { data: { data: null, msg: 'fail', code: 401 } };
    jest.spyOn(api as any, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue(response);
    jest.spyOn(api as any, 'auth').mockImplementation(() => {
      throw new Error('Authentication failed: fail code: 401');
    });

    await expect(api.loginWithPassword('user', 'pass')).rejects.toThrow('Authentication failed: fail code: 401');
  });

  it('getHomeDetails should return undefined if username/authToken missing', async () => {
    api['username'] = undefined;
    api['authToken'] = undefined;
    const result = await api.getHomeDetails();
    expect(result).toBeUndefined();
  });

  it('getHomeDetails should throw error if response.data missing', async () => {
    api['username'] = 'user';
    api['authToken'] = 'tok';
    jest.spyOn(api as any, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.get.mockResolvedValue({ data: { data: null } });

    await expect(api.getHomeDetails()).rejects.toThrow('Failed to retrieve the home details');
  });

  it('getHomeDetails should return HomeInfo if present', async () => {
    api['username'] = 'user';
    api['authToken'] = 'tok';
    const homeInfo = { home: 'info' };
    jest.spyOn(api as any, 'getAPIFor').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.get.mockResolvedValue({ data: { data: homeInfo } });

    const result = await api.getHomeDetails();
    expect(result).toBe(homeInfo);
  });

  it('getBaseUrl should throw error if response.data missing', async () => {
    jest.spyOn(api as any, 'apiForUser').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue({ data: { data: null, msg: 'fail' } });

    await expect(api['getBaseUrl']('user')).rejects.toThrow('Failed to retrieve base URL: fail');
  });

  it('getBaseUrl should return url if present', async () => {
    jest.spyOn(api as any, 'apiForUser').mockResolvedValue(mockAxiosInstance);
    mockAxiosInstance.post.mockResolvedValue({ data: { data: { url: 'http://base.url' } } });

    const result = await api['getBaseUrl']('user');
    expect(result).toBe('http://base.url');
  });

  it('apiForUser should create AxiosInstance with correct headers', async () => {
    const username = 'user';
    const baseUrl = 'http://base.url';
    const spy = jest.spyOn(mockAxiosFactory, 'create');
    await api['apiForUser'](username, baseUrl);
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
    const spy = jest.spyOn(api as any, 'loginWithAuthToken');
    const response = { data: { token: 'tok', other: 'data' }, msg: '', code: 0 };
    const result = api['auth']('user', response);
    expect(spy).toHaveBeenCalledWith('user', 'tok');
    expect(result).toBe(response.data);
  });

  it('auth should throw error if token missing', () => {
    const response = { data: null, msg: 'fail', code: 401 };
    expect(() => api['auth']('user', response)).toThrow('Authentication failed: fail code: 401');
  });

  it('loginWithAuthToken should set username and authToken', () => {
    api['loginWithAuthToken']('user', 'tok');
    expect(api['username']).toBe('user');
    expect(api['authToken']).toBe('tok');
  });
});
