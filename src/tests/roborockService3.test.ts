import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../roborockService';

describe('RoborockService - listDevices', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockIotApi: any;
  let mockLoginApi: any;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), error: jest.fn() } as any;
    mockIotApi = {
      getHome: jest.fn(),
      getScenes: jest.fn(),
      getHomev3: jest.fn(),
      getHomev2: jest.fn(),
    };
    mockLoginApi = {
      getHomeDetails: jest.fn(),
    };
    roborockService = new RoborockService(
      () => mockLoginApi,
      () => mockIotApi,
      10,
      {} as any,
      mockLogger,
    );
    roborockService['iotApi'] = mockIotApi;
    roborockService['userdata'] = { foo: 'bar' } as any;
  });

  it('should throw if homeDetails is missing', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue(undefined);
    await expect(roborockService.listDevices('user')).rejects.toThrow('Failed to retrieve the home details');
  });

  it('should return empty array if homeData is missing', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue(undefined);
    const result = await roborockService.listDevices('user');
    expect(result).toEqual([]);
  });

  it('should return devices with correct mapping', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'm1', category: 'cat1' }],
      devices: [{ duid: 'd1', localKey: 'lk', pv: 'pv', sn: 'sn', productId: 'p1', deviceStatus: { battery: 50 }, fv: 'fw', data: {} }],
      receivedDevices: [],
      rooms: [{ id: 1 }],
    });
    mockIotApi.getScenes.mockResolvedValue([{ param: JSON.stringify({ action: { items: [{ entityId: 'd1' }] } }) }]);
    const result = await roborockService.listDevices('user');
    expect(result.length).toBe(1);
    expect(result[0].duid).toBe('d1');
    expect(result[0].data.batteryLevel).toBe(100);
    expect(result[0].scenes.length).toBe(1);
  });

  it('should throw if getHomev3 fails when v3 API is needed', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'roborock.vacuum.ss07' }],
      devices: [],
      receivedDevices: [],
      rooms: [],
    });
    mockIotApi.getHomev3.mockResolvedValue(undefined);
    await expect(roborockService.listDevices('user')).rejects.toThrow('Failed to retrieve the home data from v3 API');
  });

  it('should merge v3 devices and receivedDevices if v3 API is needed', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'roborock.vacuum.ss07' }],
      devices: [],
      receivedDevices: [],
      rooms: [],
    });
    mockIotApi.getHomev3.mockResolvedValue({
      devices: [{ duid: 'd2', localKey: 'lk2', pv: 'pv2', sn: 'sn2', productId: 'p1', deviceStatus: {}, fv: 'fw2', data: {} }],
      receivedDevices: [{ duid: 'rd2', localKey: 'lk3', pv: 'pv3', sn: 'sn3', productId: 'p1', deviceStatus: {}, fv: 'fw3', data: {} }],
      rooms: [],
    });
    mockIotApi.getScenes.mockResolvedValue([]);
    const result = await roborockService.listDevices('user');
    expect(result.some((d) => d.duid === 'd2')).toBe(true);
    expect(result.some((d) => d.duid === 'rd2')).toBe(true);
  });

  it('should fallback batteryLevel to 100 if not present', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'm1', category: 'cat1' }],
      devices: [{ duid: 'd1', localKey: 'lk', pv: 'pv', sn: 'sn', productId: 'p1', deviceStatus: {}, fv: 'fw', data: {} }],
      receivedDevices: [],
      rooms: [{ id: 1 }],
    });
    mockIotApi.getScenes.mockResolvedValue([]);
    const result = await roborockService.listDevices('user');
    expect(result[0].data.batteryLevel).toBe(100);
  });

  it('should filter scenes correctly for devices', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'm1', category: 'cat1' }],
      devices: [{ duid: 'd1', localKey: 'lk', pv: 'pv', sn: 'sn', productId: 'p1', deviceStatus: {}, fv: 'fw', data: {} }],
      receivedDevices: [],
      rooms: [{ id: 1 }],
    });
    mockIotApi.getScenes.mockResolvedValue([
      { param: JSON.stringify({ action: { items: [{ entityId: 'd1' }, { entityId: 'd2' }] } }) },
      { param: JSON.stringify({ action: { items: [{ entityId: 'd2' }] } }) },
    ]);
    const result = await roborockService.listDevices('user');
    expect(result[0].scenes.length).toBe(1);
  });

  it('should handle rooms fallback from v2 and v3 APIs', async () => {
    mockLoginApi.getHomeDetails.mockResolvedValue({ rrHomeId: 1 });
    mockIotApi.getHome.mockResolvedValue({
      products: [{ id: 'p1', model: 'm1', category: 'cat1' }],
      devices: [],
      receivedDevices: [],
      rooms: [],
    });
    mockIotApi.getHomev2.mockResolvedValue({ rooms: [{ id: 2 }], products: [], devices: [], receivedDevices: [] });
    mockIotApi.getScenes.mockResolvedValue([]);
    const result = await roborockService.listDevices('user');
    expect(result.length).toBe(0);
  });
});
