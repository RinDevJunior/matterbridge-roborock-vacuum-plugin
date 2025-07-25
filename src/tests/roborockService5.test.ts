import RoborockService from '../roborockService';

describe('initializeMessageClientForLocal', () => {
  let service: any;
  let mockMessageClient: any;
  let mockLogger: any;
  let mockDevice: any;
  let mockMessageProcessor: any;
  let mockLocalClient: any;
  let mockLoginApi: any;
  let mockIotApi: any;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    mockMessageClient = {
      registerClient: jest.fn(),
      isConnected: jest.fn(),
      registerMessageListener: jest.fn(),
    };
    mockDevice = { duid: 'd1', pv: 'pv', data: { model: 'm1' }, localKey: 'lk' };
    mockMessageProcessor = {
      injectLogger: jest.fn(),
      registerListener: jest.fn(),
      getNetworkInfo: jest.fn(),
    };
    mockLocalClient = {
      connect: jest.fn(),
      isConnected: jest.fn(),
    };
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
    service.messageClient = mockMessageClient;
    service.deviceNotify = jest.fn();
    service.ipMap = new Map();
    service.localClientMap = new Map();
    service.mqttAlwaysOnDevices = new Map();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false if messageClient is undefined', async () => {
    service.messageClient = undefined;
    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('messageClient not initialized');
  });

  it('returns true and sets mqttAlwaysOnDevices if device.pv is B01', async () => {
    mockDevice.pv = 'B01';
    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(true);
    expect(service.mqttAlwaysOnDevices.get(mockDevice.duid)).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith('Device does not support local connection', mockDevice.duid);
  });

  it('returns false if local client does not connect after attempts', async () => {
    mockMessageProcessor.getNetworkInfo.mockResolvedValue({ ip: '1.2.3.4' });
    jest.spyOn(service, 'getMessageProcessor').mockReturnValue(mockMessageProcessor);
    mockMessageClient.registerClient.mockReturnValue(mockLocalClient);
    mockLocalClient.connect.mockImplementation(() => {});
    mockLocalClient.isConnected.mockReturnValue(false);
    service.ipMap.delete(mockDevice.duid);
    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Error requesting network info', expect.any(Error));
  });
});
