import { MessageProcessor } from '../../../roborockCommunication/broadcast/messageProcessor';
import { DeviceStatus } from '../../../roborockCommunication/Zmodel/deviceStatus';
import { RoomInfo } from '../../../roborockCommunication/Zmodel/roomInfo';

describe('MessageProcessor', () => {
  let mockClient: any;
  let processor: MessageProcessor;
  let mockLogger: any;

  beforeEach(() => {
    mockClient = {
      registerMessageListener: jest.fn().mockImplementation(() => {
        void 0;
      }),
      get: jest.fn(),
      send: jest.fn(),
    };
    processor = new MessageProcessor(mockClient);
    mockLogger = { debug: jest.fn(), notice: jest.fn() };
    processor.injectLogger(mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should inject logger', () => {
    processor.injectLogger(mockLogger);
    expect(processor.logger).toBe(mockLogger);
  });

  it('getNetworkInfo should call client.get with correct params', async () => {
    mockClient.get.mockResolvedValue('networkInfo');
    const result = await processor.getNetworkInfo('duid');
    expect(mockClient.get).toHaveBeenCalledWith('duid', expect.any(Object));
    expect(result).toBe('networkInfo');
  });

  it('getDeviceStatus should return DeviceStatus if response exists', async () => {
    const mockDeviceStatus = { status: 'ok' };
    mockClient.get.mockResolvedValue([mockDeviceStatus]);
    const result = await processor.getDeviceStatus('duid');
    expect(mockLogger.debug).toHaveBeenCalled();
    expect(result).toBeInstanceOf(DeviceStatus);
  });

  it('getDeviceStatus should return undefined if response is falsy', async () => {
    mockClient.get.mockResolvedValue(undefined);
    const result = await processor.getDeviceStatus('duid');
    expect(result).toBeUndefined();
  });

  it('getRooms should return RoomInfo', async () => {
    const rooms = [
      { id: 1, name: 'Room1' },
      { id: 2, name: 'Room2' },
    ];
    mockClient.get.mockResolvedValue([[1, 2]]);
    const result = await processor.getRooms('duid', rooms);
    expect(result).toBeInstanceOf(RoomInfo);
  });

  it('gotoDock should call client.send', async () => {
    await processor.gotoDock('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('startClean should call client.send', async () => {
    await processor.startClean('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('startRoomClean should call client.send with correct params', async () => {
    await processor.startRoomClean('duid', [1, 2], 3);
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('pauseClean should call client.send', async () => {
    await processor.pauseClean('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('resumeClean should call client.send', async () => {
    await processor.resumeClean('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('stopClean should call client.send', async () => {
    await processor.stopClean('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('sendCustomMessage should call client.send', async () => {
    const def = { method: 'custom' };
    await processor.sendCustomMessage('duid', def as any);
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('getCustomMessage should call client.get', async () => {
    const def = { method: 'custom' };
    await processor.getCustomMessage('duid', def as any);
    expect(mockClient.get).toHaveBeenCalledWith('duid', def);
  });

  it('findMyRobot should call client.send', async () => {
    await processor.findMyRobot('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('getCleanModeData should parse and return correct values', async () => {
    mockClient.get
      .mockResolvedValueOnce([306]) // get_mop_mode
      .mockResolvedValueOnce([101]) // get_custom_mode
      .mockResolvedValueOnce({ water_box_mode: 207, distance_off: 5 }); // get_water_box_custom_mode

    const result = await processor.getCleanModeData('duid');
    expect(result).toEqual({
      suctionPower: 101,
      waterFlow: 207,
      distance_off: 5,
      mopRoute: 306,
    });
  });

  it('changeCleanMode should call logger.notice and client.send as needed', async () => {
    mockLogger.notice = jest.fn();
    mockClient.get.mockResolvedValueOnce(110); // currentMopMode
    await processor.changeCleanMode('duid', 101, 207, 306, 5);
    expect(mockLogger.notice).toHaveBeenCalled();
  });
});
