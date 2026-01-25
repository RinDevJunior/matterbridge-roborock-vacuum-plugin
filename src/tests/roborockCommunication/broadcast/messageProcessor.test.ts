import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageProcessor } from '../../../roborockCommunication/mqtt/messageProcessor.js';
import { DeviceStatus } from '../../../roborockCommunication/models/index.js';

describe('MessageProcessor', () => {
  let mockClient: any;
  let processor: MessageProcessor;
  let mockLogger: any;

  beforeEach(() => {
    mockClient = {
      registerMessageListener: vi.fn().mockImplementation(() => {
        void 0;
      }),
      get: vi.fn(),
      send: vi.fn(),
    };
    processor = new MessageProcessor(mockClient);
    mockLogger = { debug: vi.fn(), notice: vi.fn() };
    processor.injectLogger(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    mockClient.get.mockResolvedValue([[1, 2]]);
    const result = await processor.getRooms('duid');
    expect(result).not.toBeUndefined();
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
    expect(mockClient.get).toHaveBeenCalledWith('duid', expect.any(Object));
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
    mockLogger.notice = vi.fn();
    mockClient.get.mockResolvedValueOnce(110); // currentMopMode
    await processor.changeCleanMode('duid', 101, 207, 306, 5);
    expect(mockLogger.notice).toHaveBeenCalled();
  });

  it('getDeviceStatusOverMQTT should return DeviceStatus if response exists', async () => {
    const mockDeviceStatus = { status: 'ok' };
    mockClient.get.mockResolvedValue([mockDeviceStatus]);
    const result = await processor.getDeviceStatusOverMQTT('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('MQTT - Device status: ', expect.any(String));
    expect(result).toBeInstanceOf(DeviceStatus);
  });

  it('getDeviceStatusOverMQTT should return undefined if response is falsy', async () => {
    mockClient.get.mockResolvedValue(undefined);
    const result = await processor.getDeviceStatusOverMQTT('duid');
    expect(result).toBeUndefined();
  });

  it('getCleanModeData should handle array responses for suctionPower', async () => {
    mockClient.get
      .mockResolvedValueOnce([306]) // get_mop_mode (array)
      .mockResolvedValueOnce([101]) // get_custom_mode (array, not nested)
      .mockResolvedValueOnce([207]); // get_water_box_custom_mode (array)

    const result = await processor.getCleanModeData('duid');
    expect(result.suctionPower).toBe(101);
    expect(result.mopRoute).toBe(306);
  });

  it('getCleanModeData should handle non-array responses', async () => {
    mockClient.get
      .mockResolvedValueOnce(306) // get_mop_mode (number)
      .mockResolvedValueOnce(101) // get_custom_mode (number)
      .mockResolvedValueOnce(207); // get_water_box_custom_mode (number)

    const result = await processor.getCleanModeData('duid');
    expect(result.suctionPower).toBe(101);
    expect(result.waterFlow).toBe(207);
    expect(result.mopRoute).toBe(306);
  });

  it('getCleanModeData should extract distance_off from object response', async () => {
    mockClient.get.mockResolvedValueOnce([306]).mockResolvedValueOnce([101]).mockResolvedValueOnce({ water_box_mode: 207, distance_off: 10 });

    const result = await processor.getCleanModeData('duid');
    expect(result.distance_off).toBe(10);
    expect(result.waterFlow).toBe(207);
  });

  it('getCleanModeData should handle object without distance_off', async () => {
    mockClient.get.mockResolvedValueOnce([306]).mockResolvedValueOnce([101]).mockResolvedValueOnce({ water_box_mode: 207 });

    const result = await processor.getCleanModeData('duid');
    expect(result.distance_off).toBe(0);
    expect(result.waterFlow).toBe(207);
  });

  it('changeCleanMode should return early if smartMopMode with smartMopRoute', async () => {
    mockClient.get.mockResolvedValueOnce(110); // smartMopMode
    await processor.changeCleanMode('duid', 0, 0, 306, 0); // smartMopRoute = 306
    expect(mockClient.send).not.toHaveBeenCalled();
  });

  it('changeCleanMode should return early if customMopMode with customMopRoute', async () => {
    mockClient.get.mockResolvedValueOnce(106); // customMopMode
    await processor.changeCleanMode('duid', 0, 0, 302, 0); // customMopRoute = 302
    expect(mockClient.send).not.toHaveBeenCalled();
  });

  it('changeCleanMode should switch from smart to custom mode first', async () => {
    mockClient.get.mockResolvedValueOnce(110); // smartMopMode
    await processor.changeCleanMode('duid', 101, 207, 303, 0);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_mop_mode',
      }),
    );
  });

  it('changeCleanMode should set suctionPower if non-zero', async () => {
    mockClient.get.mockResolvedValueOnce(106); // customMopMode
    await processor.changeCleanMode('duid', 101, 0, 303, 0);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_custom_mode',
      }),
    );
  });

  it('changeCleanMode should set water_box_custom_mode with distance_off for CustomizeWithDistanceOff', async () => {
    mockClient.get.mockResolvedValueOnce(106);
    await processor.changeCleanMode('duid', 0, 207, 0, 5); // 207 is CustomizeWithDistanceOff
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_water_box_custom_mode',
        params: { water_box_mode: 207, distance_off: 5 },
      }),
    );
  });

  it('changeCleanMode should set water_box_custom_mode without distance_off for other modes', async () => {
    mockClient.get.mockResolvedValueOnce(106);
    await processor.changeCleanMode('duid', 0, 200, 0, 0);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_water_box_custom_mode',
        params: [200],
      }),
    );
  });

  it('changeCleanMode should set mopRoute if non-zero', async () => {
    mockClient.get.mockResolvedValueOnce(106);
    await processor.changeCleanMode('duid', 0, 0, 303, 0);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_mop_mode',
      }),
    );
  });

  it('changeCleanMode should not set params if all are zero', async () => {
    mockClient.get.mockResolvedValueOnce(106);
    mockClient.send.mockClear();
    await processor.changeCleanMode('duid', 0, 0, 0, 0);
    expect(mockClient.send).not.toHaveBeenCalled();
  });
});
