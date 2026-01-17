import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { RoborockIoTApi } from '../../../roborockCommunication/RESTAPI/roborockIoTApi';
import MockAdapter from 'axios-mock-adapter';

describe('RoborockIoTApi', () => {
  let mockLogger: any;
  let mockAxiosInstance: MockAdapter;
  let mockUserData: any;
  let api: RoborockIoTApi;

  beforeEach(() => {
    mockLogger = { error: vi.fn() };
    mockAxiosInstance = new MockAdapter(axios);
    mockUserData = {
      rriot: {
        r: { a: 'http://base.url' },
        u: 'uid',
        s: 'sid',
        h: 'hkey',
      },
    };
    api = new RoborockIoTApi(mockUserData, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize logger and api', () => {
    expect(api.logger).toBe(mockLogger);
    expect(api['api']).toBeDefined();
  });

  it('getHome should return home if result exists', async () => {
    const home = { id: 1 };
    mockAxiosInstance.onGet('user/homes/1').reply(200, { result: home });
    const result = await api.getHome(1);
    expect(result).toStrictEqual(home);
  });

  it('getHome should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('user/homes/1').reply(200, {});
    const result = await api.getHome(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve the home data');
  });

  it('getHomev2 should return home if result exists', async () => {
    const home = { id: 2 };
    mockAxiosInstance.onGet('v2/user/homes/2').reply(200, { result: home });
    const result = await api.getHomev2(2);
    expect(result).toStrictEqual(home);
  });

  it('getHomev3 should return home if result exists', async () => {
    const home = { id: 3 };
    mockAxiosInstance.onGet('v3/user/homes/3').reply(200, { result: home });
    const result = await api.getHomev3(3);
    expect(result).toStrictEqual(home);
  });

  it('getScenes should return scenes if result exists', async () => {
    const scenes = [{ id: 1 }, { id: 2 }];
    mockAxiosInstance.onGet('user/scene/home/1').reply(200, { result: scenes });
    const result = await api.getScenes(1);
    expect(result).toStrictEqual(scenes);
  });

  it('getScenes should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('user/scene/home/1').reply(200, {});
    const result = await api.getScenes(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve scene');
  });

  it('startScene should return result if present', async () => {
    mockAxiosInstance.onPost('user/scene/1/execute').reply(200, { result: 'started' });
    const result = await api.startScene(1);
    expect(result).toBe('started');
  });

  it('startScene should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onPost('user/scene/1/execute').reply(200, {});
    const result = await api.startScene(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute scene');
  });

  it('getCustom should return result if present', async () => {
    mockAxiosInstance.onGet('/custom/url').reply(200, { result: 'custom' });
    const result = await api.getCustom('/custom/url');
    expect(result).toBe('custom');
  });

  it('getCustom should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('/custom/url').reply(200, {});
    const result = await api.getCustom('/custom/url');
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute scene');
  });

  it('should create axios instance with timeout, redirects and httpsAgent', () => {
    const instance = api['api'];
    expect(instance).toBeDefined();
    expect(instance.defaults).toMatchObject({ baseURL: 'http://base.url', timeout: 10000, maxRedirects: 5 });
    expect(instance.defaults.httpsAgent).toBeDefined();
  });

  it('getHomev2 should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('v2/user/homes/2').networkErrorOnce();
    const result = await api.getHomev2(2);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getHomev2 failed'));
  });

  it('startScene should log error and return undefined on exception', async () => {
    mockAxiosInstance.onPost('user/scene/5/execute').networkErrorOnce();
    const result = await api.startScene(5);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('startScene failed'));
  });

  it('getHomev2 handles ETIMEDOUT error and logs', async () => {
    mockAxiosInstance.onGet('v2/user/homes/2').timeoutOnce();
    const result = await api.getHomev2(2);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getHomev2 failed'));
  });

  it('getHomev2 handles ECONNRESET error and logs', async () => {
    mockAxiosInstance.onGet('v2/user/homes/2').networkErrorOnce();
    const result = await api.getHomev2(2);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getHomev2 failed'));
  });

  it('getHome should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('user/homes/1').networkErrorOnce();
    const result = await api.getHome(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getHome failed'));
  });

  it('getHomev3 should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('v3/user/homes/3').reply(200, {});
    const result = await api.getHomev3(3);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve the home data');
  });

  it('getHomev3 should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('v3/user/homes/3').networkErrorOnce();
    const result = await api.getHomev3(3);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getHomev3 failed'));
  });

  it('getScenes should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('user/scene/home/1').networkErrorOnce();
    const result = await api.getScenes(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getScenes failed'));
  });

  it('getCustom should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('/custom/url').networkErrorOnce();
    const result = await api.getCustom('/custom/url');
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('getCustom failed'));
  });
});
