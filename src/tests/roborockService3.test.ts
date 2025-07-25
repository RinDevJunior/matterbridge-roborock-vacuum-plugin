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
});
