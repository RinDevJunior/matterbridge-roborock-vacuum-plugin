import RoborockService from '../roborockService';
import type { RoborockAuthenticateApi, RoborockIoTApi } from '../roborockCommunication/index';
import type ClientManager from '../clientManager';
import type { AnsiLogger } from 'matterbridge/logger';

interface MockLogger {
  debug: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
}
interface MockIotApi {
  getHomev2: jest.Mock<Promise<unknown>, [number?]>;
  getHomev3: jest.Mock<Promise<unknown>, [number?]>;
  getHome: jest.Mock<Promise<unknown>, [number?]>;
  getScenes: jest.Mock;
  startScene: jest.Mock;
  getCustom: jest.Mock;
  api: Record<string, unknown>;
  logger: MockLogger;
}
interface MockLoginApi {
  getHomeDetails: jest.Mock;
}

describe('getHomeDataForUpdating', () => {
  let service: RoborockService;
  let mockIotApi: MockIotApi;
  let mockLogger: MockLogger;
  const homeid = 123;
  let mockLoginApi: MockLoginApi;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    mockIotApi = {
      getHomev2: jest.fn(),
      getHomev3: jest.fn(),
      getHome: jest.fn(),
      getScenes: jest.fn(),
      startScene: jest.fn(),
      getCustom: jest.fn(),
      api: {},
      logger: mockLogger,
    };
    mockLoginApi = {
      getHomeDetails: jest.fn(),
    };
    service = new RoborockService(
      (_logger: unknown, _baseUrl: string) => {
        void _logger;
        void _baseUrl;
        return mockLoginApi as unknown as RoborockAuthenticateApi;
      },
      (_logger: unknown, _ud: unknown) => {
        void _logger;
        void _ud;
        return mockIotApi as unknown as RoborockIoTApi;
      },
      10,
      {} as unknown as ClientManager,
      mockLogger as unknown as AnsiLogger,
    );
    (service as unknown as { iotApi?: MockIotApi }).iotApi = mockIotApi;
    (service as unknown as { userdata?: Record<string, unknown> }).userdata = { user: 'test' };
  });

  it('returns home data from v2 API when rooms are present', async () => {
    const homeData = {
      products: [{ id: 'p1', model: 'm1' }],
      devices: [{ duid: 'd1', productId: 'p1', sn: 'sn1', fv: '1.0', localKey: 'lk', pv: 'pv', deviceStatus: { 8: 50 } }],
      receivedDevices: [],
      rooms: [{ id: 1 }],
    };
    mockIotApi.getHomev2.mockResolvedValue(homeData);
    const result = await service.getHomeDataForUpdating(homeid);
    if (!result) throw new Error('getHomeDataForUpdating returned undefined');
    expect(result.devices[0].rooms).toEqual(homeData.rooms);
    expect(result.devices[0].data.batteryLevel).toBe(100);
  });

  it('falls back to v3 API for rooms if v2 rooms are empty', async () => {
    const homeData = {
      products: [{ id: 'p1', model: 'm1' }],
      devices: [{ duid: 'd1', productId: 'p1', sn: 'sn1', fv: '1.0', localKey: 'lk', pv: 'pv', deviceStatus: {} }],
      receivedDevices: [],
      rooms: [],
    };
    const v3Data = { rooms: [{ id: 2 }] };
    mockIotApi.getHomev2.mockResolvedValue(homeData);
    mockIotApi.getHomev3.mockResolvedValue(v3Data);
    const result = await service.getHomeDataForUpdating(homeid);
    if (!result) throw new Error('getHomeDataForUpdating returned undefined');
    expect(result.devices[0].rooms).toEqual(v3Data.rooms);
  });

  it('falls back to v1 API for rooms if v2 and v3 rooms are empty', async () => {
    const homeData = {
      products: [{ id: 'p1', model: 'm1' }],
      devices: [{ duid: 'd1', productId: 'p1', sn: 'sn1', fv: '1.0', localKey: 'lk', pv: 'pv', deviceStatus: {} }],
      receivedDevices: [],
      rooms: [],
    };
    mockIotApi.getHomev2.mockResolvedValue(homeData);
    mockIotApi.getHomev3.mockResolvedValue({ rooms: [] });
    mockIotApi.getHome.mockResolvedValue({ rooms: [{ id: 3 }] });
    const result = await service.getHomeDataForUpdating(homeid);
    if (!result) throw new Error('getHomeDataForUpdating returned undefined');
    expect(result.devices[0].rooms).toEqual([{ id: 3 }]);
  });

  it('throws error if home data cannot be retrieved', async () => {
    mockIotApi.getHomev2.mockResolvedValue(undefined);
    const result = await service.getHomeDataForUpdating(homeid);
    expect(result).toBeUndefined();
  });
});
