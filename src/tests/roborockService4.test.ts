import RoborockService from '../roborockService';

describe('getHomeDataForUpdating', () => {
  let service;
  let mockIotApi;
  let mockLogger;
  const homeid = 123;
  let mockLoginApi: any;

  beforeEach(() => {
    mockIotApi = {
      getHomev2: jest.fn(),
      getHomev3: jest.fn(),
      getHome: jest.fn(),
    };
    mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    mockLoginApi = {
      getHomeDetails: jest.fn(),
    };
    service = new RoborockService(
      () => mockLoginApi,
      () => mockIotApi,
      10,
      {} as any,
      mockLogger,
    );
    service.iotApi = mockIotApi;
    service.userdata = { user: 'test' };
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
    expect(result.devices[0].rooms).toEqual([{ id: 3 }]);
  });

  it('throws error if home data cannot be retrieved', async () => {
    mockIotApi.getHomev2.mockResolvedValue(undefined);
    await expect(service.getHomeDataForUpdating(homeid)).rejects.toThrow('Failed to retrieve the home data');
  });
});
