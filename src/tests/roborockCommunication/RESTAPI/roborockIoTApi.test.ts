import axios from 'axios';
import { RoborockIoTApi } from '../../../roborockCommunication/RESTAPI/roborockIoTApi';

describe('RoborockIoTApi', () => {
  let mockLogger: any;
  let mockAxiosInstance: any;
  let mockUserData: any;
  let api: RoborockIoTApi;

  beforeEach(() => {
    mockLogger = { error: jest.fn() };
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: { request: { use: jest.fn() } },
      getUri: jest.fn((config) => config.url),
    };
    mockUserData = {
      rriot: {
        r: { a: 'http://base.url' },
        u: 'uid',
        s: 'sid',
        h: 'hkey',
      },
    };
    jest.spyOn(axios, 'create').mockReturnValue(mockAxiosInstance);
    api = new RoborockIoTApi(mockUserData, mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize logger and api', () => {
    expect(api.logger).toBe(mockLogger);
    expect(api['api']).toBe(mockAxiosInstance);
  });

  it('getHome should return home if result exists', async () => {
    const home = { id: 1 };
    mockAxiosInstance.get.mockResolvedValue({ data: { result: home } });
    const result = await api.getHome(1);
    expect(result).toBe(home);
  });

  it('getHome should log error and return undefined if result missing', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: {} });
    const result = await api.getHome(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve the home data');
  });

  it('getHomev2 should return home if result exists', async () => {
    const home = { id: 2 };
    mockAxiosInstance.get.mockResolvedValue({ data: { result: home } });
    const result = await api.getHomev2(2);
    expect(result).toBe(home);
  });

  it('getHomev3 should return home if result exists', async () => {
    const home = { id: 3 };
    mockAxiosInstance.get.mockResolvedValue({ data: { result: home } });
    const result = await api.getHomev3(3);
    expect(result).toBe(home);
  });

  it('getScenes should return scenes if result exists', async () => {
    const scenes = [{ id: 1 }, { id: 2 }];
    mockAxiosInstance.get.mockResolvedValue({ data: { result: scenes } });
    const result = await api.getScenes(1);
    expect(result).toBe(scenes);
  });

  it('getScenes should log error and return undefined if result missing', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: {} });
    const result = await api.getScenes(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve scene');
  });

  it('startScene should return result if present', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: { result: 'started' } });
    const result = await api.startScene(1);
    expect(result).toBe('started');
  });

  it('startScene should log error and return undefined if result missing', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: {} });
    const result = await api.startScene(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute scene');
  });

  it('getCustom should return result if present', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { result: 'custom' } });
    const result = await api.getCustom('/custom/url');
    expect(result).toBe('custom');
  });

  it('getCustom should log error and return undefined if result missing', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: {} });
    const result = await api.getCustom('/custom/url');
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute scene');
  });
});
