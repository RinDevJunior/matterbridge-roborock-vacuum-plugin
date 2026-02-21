import axios, { AxiosStatic } from 'axios';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import MockAdapter from 'axios-mock-adapter';
import { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';
import { UserData } from '../../../roborockCommunication/models/userData.js';
import { asType, asPartial, createMockLogger } from '../../helpers/testUtils.js';
import { Home } from '../../../roborockCommunication/models/home.js';
import { DeviceModel } from '../../../roborockCommunication/models/deviceModel.js';
import { Product } from '../../../roborockCommunication/models/product.js';
import { Device } from '../../../roborockCommunication/models/index.js';
import { RoomEntity } from '../../../core/domain/entities/Room.js';

const makeUserData = () => ({ rriot: { r: { a: 'https://api.example' }, u: 'uid', s: 's', h: 'hmac' } });

describe('RoborockIoTApi (additional)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getHome returns result when API returns a result', async () => {
    const userdata = makeUserData();
    const logger = createMockLogger();

    const expected = { id: 1, products: [], devices: [], receivedDevices: [], rooms: [] };

    const mockApi: any = {
      get: vi.fn().mockResolvedValue({ data: { result: expected } }),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };

    vi.spyOn(axios, 'create').mockImplementation(() => mockApi);

    const api = new RoborockIoTApi(asType<UserData>(userdata), asType(logger));
    const res = await api.getHome(1);
    expect(res).toEqual(expected);
    expect(mockApi.get).toHaveBeenCalledWith('user/homes/1');
  });

  it('getHomeWithProducts uses v3 API and merges devices when product requires v3', async () => {
    const userdata = makeUserData();
    const logger = createMockLogger();

    const homeV1 = {
      id: 2,
      products: [{ model: 'roborock.vacuum.ss07' }],
      devices: [{ duid: 'a' }],
      receivedDevices: [{ duid: 'ra' }],
      rooms: [],
    };

    const homeV3 = {
      id: 2,
      products: [],
      devices: [{ duid: 'b' }],
      receivedDevices: [{ duid: 'rb' }],
      rooms: [],
    };

    const mockApi: any = {
      get: vi.fn((url: string) => {
        if (url === 'user/homes/2') return Promise.resolve({ data: { result: homeV1 } });
        if (url === 'v3/user/homes/2') return Promise.resolve({ data: { result: homeV3 } });
        return Promise.resolve({ data: {} });
      }),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };

    vi.spyOn(axios, 'create').mockImplementation(() => mockApi);

    const api = new RoborockIoTApi(asType<UserData>(userdata), asType<AnsiLogger>(logger));
    const res = await api.getHomeWithProducts(2);

    expect(res).toBeDefined();
    expect(res?.devices).toEqual([{ duid: 'a' }, { duid: 'b' }]);
    expect(res?.receivedDevices).toEqual([{ duid: 'ra' }, { duid: 'rb' }]);
    expect(mockApi.get).toHaveBeenCalledWith('user/homes/2');
    expect(mockApi.get).toHaveBeenCalledWith('v3/user/homes/2');
  });

  it('getHomeWithProducts fills rooms from v2 when v1 has no rooms', async () => {
    const userdata = makeUserData();
    const logger = createMockLogger();

    const homeV1 = {
      id: 3,
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [],
    };

    const homeV2 = {
      id: 3,
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [{ id: 11, name: 'Living' }],
    };

    const mockApi: any = {
      get: vi.fn((url: string) => {
        if (url === 'user/homes/3') return Promise.resolve({ data: { result: homeV1 } });
        if (url === 'v2/user/homes/3') return Promise.resolve({ data: { result: homeV2 } });
        return Promise.resolve({ data: {} });
      }),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };

    vi.spyOn(axios, 'create').mockImplementation(() => mockApi);

    const api = new RoborockIoTApi(asType<UserData>(userdata), asType<AnsiLogger>(logger));
    const res = await api.getHomeWithProducts(3);

    expect(res).toBeDefined();
    expect(res?.rooms).toEqual(homeV2.rooms);
  });
});

describe('RoborockIoTApi', () => {
  describe('getHomeWithProducts', () => {
    it('returns home data as-is if no v3 or v2 logic triggered', async () => {
      const home = asPartial<Home>({
        id: 1,
        name: 'Home1',
        products: [asPartial<Product>({ model: DeviceModel.S5 })],
        devices: [],
        receivedDevices: [],
        rooms: [asPartial<RoomEntity>({ id: 1 })],
      });
      vi.spyOn(api, 'getHome').mockResolvedValue(home);
      const result = await api.getHomeWithProducts(1);
      expect(result).toBe(home);
    });

    it('merges v3 devices/receivedDevices if v3 logic triggered', async () => {
      const home = {
        id: 1,
        name: 'Home1',
        products: [{ model: 'roborock.vacuum.ss07' }],
        devices: [{ duid: 'a' }],
        receivedDevices: [{ duid: 'b' }],
        rooms: [asPartial<RoomEntity>({ id: 1 })],
      };
      const v3 = {
        devices: [{ duid: 'c' }],
        receivedDevices: [{ duid: 'd' }],
        rooms: [asPartial<RoomEntity>({ id: 2 })],
      };
      vi.spyOn(api, 'getHome').mockResolvedValue(
        asPartial<Home>({
          id: 1,
          name: 'Home1',
          products: [asPartial<Product>({ model: DeviceModel.Q10_S5_PLUS })],
          devices: [asPartial<Device>({ duid: 'a' })],
          receivedDevices: [asPartial<Device>({ duid: 'b' })],
          rooms: [asPartial<RoomEntity>({ id: 1 })],
        }),
      );
      vi.spyOn(api, 'getHomev3').mockResolvedValue(
        asPartial<Home>({
          devices: [asPartial<Device>({ duid: 'c' })],
          receivedDevices: [asPartial<Device>({ duid: 'd' })],
          rooms: [asPartial<RoomEntity>({ id: 2 })],
        }),
      );
      const result = await api.getHomeWithProducts(1);
      expect(result?.devices).toContainEqual({ duid: 'a' });
      expect(result?.devices).toContainEqual({ duid: 'c' });
      expect(result?.receivedDevices).toContainEqual({ duid: 'b' });
      expect(result?.receivedDevices).toContainEqual({ duid: 'd' });
    });

    it('throws if v3 API is needed but fails', async () => {
      vi.spyOn(api, 'getHome').mockResolvedValue(
        asPartial<Home>({ id: 1, name: 'Home1', products: [asPartial<Product>({ model: DeviceModel.Q10_S5_PLUS })] }),
      );
      vi.spyOn(api, 'getHomev3').mockResolvedValue(undefined);
      await expect(api.getHomeWithProducts(1)).rejects.toThrow('Failed to retrieve the home data from v3 API');
    });

    it('merges v2 rooms if rooms are empty and v2 returns rooms', async () => {
      vi.spyOn(api, 'getHome').mockResolvedValue(
        asPartial<Home>({
          id: 1,
          name: 'Home1',
          products: [asPartial<Product>({ model: 'other.model' })],
          devices: [],
          receivedDevices: [],
          rooms: [],
        }),
      );
      vi.spyOn(api, 'getHomev2').mockResolvedValue(
        asPartial<Home>({ id: 99, rooms: [asPartial<RoomEntity>({ id: 99 })] }),
      );
      const result = await api.getHomeWithProducts(1);
      expect(result?.rooms).toContainEqual({ id: 99 });
    });

    it('returns home if rooms are empty and v2 returns no rooms', async () => {
      vi.spyOn(api, 'getHome').mockResolvedValue(
        asPartial<Home>({
          id: 1,
          name: 'Home1',
          products: [asPartial<Product>({ model: 'other.model' })],
          devices: [],
          receivedDevices: [],
          rooms: [],
        }),
      );
      vi.spyOn(api, 'getHomev2').mockResolvedValue(undefined);
      vi.spyOn(api, 'getHomev3').mockResolvedValue(undefined);
      const result = await api.getHomeWithProducts(1);
      expect(result).toBeDefined();
      expect(result?.rooms).toEqual([]);
    });

    it('merges v3 rooms if v2 has no rooms but v3 does', async () => {
      vi.spyOn(api, 'getHome').mockResolvedValue(
        asPartial<Home>({
          id: 1,
          name: 'Home1',
          products: [asPartial<Product>({ model: 'other.model' })],
          devices: [],
          receivedDevices: [],
          rooms: [],
        }),
      );
      vi.spyOn(api, 'getHomev2').mockResolvedValue(asPartial<Home>({ id: 99, rooms: [] }));
      vi.spyOn(api, 'getHomev3').mockResolvedValue(
        asPartial<Home>({ id: 77, rooms: [asPartial<RoomEntity>({ id: 77, name: 'Garage' })] }),
      );

      const result = await api.getHomeWithProducts(1);
      expect(result?.rooms).toContainEqual({ id: 77, name: 'Garage' });
    });

    it('returns undefined and logs if getHome returns undefined', async () => {
      vi.spyOn(api, 'getHome').mockResolvedValue(undefined);
      const result = await api.getHomeWithProducts(1);
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('[getHomeWithProducts Step 1] Failed to retrieve the home data');
      expect(mockLogger.error).toHaveBeenCalledWith('[getHomeWithProducts Step 2] Failed to retrieve the home data');
      expect(mockLogger.error).toHaveBeenCalledWith('[getHomeWithProducts Step 3] Failed to retrieve the home data');
    });
  });
  let mockLogger: AnsiLogger;
  let mockAxiosInstance: MockAdapter;
  let mockUserData: any;
  let api: RoborockIoTApi;

  beforeEach(() => {
    mockLogger = createMockLogger();

    const mockAxiosFactory = asPartial<AxiosStatic>({
      create: vi.fn((config) => {
        const axiosInstance = axios.create(config);
        mockAxiosInstance = new MockAdapter(axiosInstance as any);
        return axiosInstance;
      }),
    });

    mockUserData = {
      rriot: {
        r: { a: 'http://base.url' },
        u: 'uid',
        s: 'sid',
        h: 'hkey',
      },
    };
    api = new RoborockIoTApi(asType<UserData>(mockUserData), mockLogger, mockAxiosFactory);
  });

  afterEach(() => {
    mockAxiosInstance.reset();
    vi.restoreAllMocks();
  });

  it('should initialize logger and api', () => {
    expect(api.logger).toBe(mockLogger);
    expect(api['api']).toBeDefined();
  });

  it('getHome should return home if result exists', async () => {
    const home = { id: 1, name: 'Home1' };
    mockAxiosInstance.onGet('user/homes/1').reply(200, { result: home });
    const result = await api.getHome(1);
    expect(result).toEqual(home);
  });

  it('getHome should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('user/homes/1').reply(200, {});
    const result = await api.getHome(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('[getHome] Failed to retrieve the home data');
  });

  it('getHomev2 should return home if result exists', async () => {
    const home = { id: 2, name: 'Home2' };
    mockAxiosInstance.onGet('v2/user/homes/2').reply(200, { result: home });
    const result = await api.getHomev2(2);
    expect(result).toEqual(home);
  });

  it('getHomev3 should return home if result exists', async () => {
    const home = { id: 3, name: 'Home3' };
    mockAxiosInstance.onGet('v3/user/homes/3').reply(200, { result: home });
    const result = await api.getHomev3(3);
    expect(result).toEqual(home);
  });

  it('getScenes should return scenes if result exists', async () => {
    const scenes = [{ id: 1 }, { id: 2 }];
    mockAxiosInstance.onGet('user/scene/home/1').reply(200, { result: scenes });
    const result = await api.getScenes(1);
    expect(result).toEqual(scenes);
  });

  it('getScenes should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('user/scene/home/1').reply(200, {});
    const result = await api.getScenes(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('[getScenes] Failed to retrieve scenes');
  });

  it('startScene should return result if present', async () => {
    mockAxiosInstance.onPost('user/scene/1/execute').reply(200, { success: true });
    const result = await api.startScene(1);
    expect(result).toBe(true);
  });

  it('startScene should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onPost('user/scene/1/execute').reply(200, {});
    const result = await api.startScene(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('[startScene] Failed to execute scene');
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
    expect(mockLogger.error).toHaveBeenCalledWith('[getCustom] Failed to execute custom request');
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
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getHomev2] Failed'));
  });

  it('startScene should log error and return undefined on exception', async () => {
    mockAxiosInstance.onPost('user/scene/5/execute').networkErrorOnce();
    const result = await api.startScene(5);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[startScene] Failed'));
  });

  it('getHomev2 handles ETIMEDOUT error and logs', async () => {
    mockAxiosInstance.onGet('v2/user/homes/2').timeoutOnce();
    const result = await api.getHomev2(2);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getHomev2] Failed'));
  });

  it('getHomev2 handles ECONNRESET error and logs', async () => {
    mockAxiosInstance.onGet('v2/user/homes/2').networkErrorOnce();
    const result = await api.getHomev2(2);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getHomev2] Failed'));
  });

  it('getHome should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('user/homes/1').networkErrorOnce();
    const result = await api.getHome(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getHome] Failed'));
  });

  it('getHomev3 should log error and return undefined if result missing', async () => {
    mockAxiosInstance.onGet('v3/user/homes/3').reply(200, {});
    const result = await api.getHomev3(3);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('[getHomev3] Failed to retrieve the home data');
  });

  it('getHomev3 should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('v3/user/homes/3').networkErrorOnce();
    const result = await api.getHomev3(3);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getHomev3] Failed'));
  });

  it('getScenes should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('user/scene/home/1').networkErrorOnce();
    const result = await api.getScenes(1);
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getScenes] Failed'));
  });

  it('getCustom should log error and return undefined on exception', async () => {
    mockAxiosInstance.onGet('/custom/url').networkErrorOnce();
    const result = await api.getCustom('/custom/url');
    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('[getCustom] Failed'));
  });
});
