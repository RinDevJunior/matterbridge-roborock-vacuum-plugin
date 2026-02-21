import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { DeviceStatus } from '../../../roborockCommunication/models/index.js';
import { V10MessageDispatcher } from '../../../roborockCommunication/protocol/dispatcher/V10MessageDispatcher.js';
import { asType } from '../../testUtils.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

describe('V10MessageDispatcher', () => {
  let mockClient: any;
  let processor: V10MessageDispatcher;
  let mockLogger: AnsiLogger;

  beforeEach(() => {
    mockClient = {
      registerMessageListener: vi.fn().mockImplementation(() => {
        void 0;
      }),
      get: vi.fn(),
      send: vi.fn(),
    };
    mockLogger = asType<AnsiLogger>({
      debug: vi.fn(),
      notice: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    processor = new V10MessageDispatcher(mockLogger, mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('gotoDock should call client.send', async () => {
    await processor.goHome('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('startClean should call client.send', async () => {
    await processor.startCleaning('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('startRoomClean should call client.send with correct params', async () => {
    await processor.startRoomCleaning('duid', [1, 2], 3);
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('pauseClean should call client.send', async () => {
    await processor.pauseCleaning('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('resumeClean should call client.send', async () => {
    await processor.resumeCleaning('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('stopClean should call client.send', async () => {
    await processor.stopCleaning('duid');
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('sendCustomMessage should call client.send', async () => {
    const def = { method: 'custom' };
    await processor.sendCustomMessage('duid', asType(def));
    expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
  });

  it('getCustomMessage should call client.get', async () => {
    const def = { method: 'custom' };
    await processor.getCustomMessage('duid', asType(def));
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
    const setting = new CleanModeSetting(101, 207, 5, 306, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
    expect(mockLogger.notice).toHaveBeenCalled();
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
    mockClient.get
      .mockResolvedValueOnce([306])
      .mockResolvedValueOnce([101])
      .mockResolvedValueOnce({ water_box_mode: 207, distance_off: 10 });

    const result = await processor.getCleanModeData('duid');
    expect(result.distance_off).toBe(10);
    expect(result.waterFlow).toBe(207);
  });

  it('getCleanModeData should handle object without distance_off', async () => {
    mockClient.get
      .mockResolvedValueOnce([306])
      .mockResolvedValueOnce([101])
      .mockResolvedValueOnce({ water_box_mode: 207 });

    const result = await processor.getCleanModeData('duid');
    expect(result.distance_off).toBe(0);
    expect(result.waterFlow).toBe(207);
  });

  it('changeCleanMode should return early if smartMopMode with smartMopRoute', async () => {
    mockClient.get.mockResolvedValueOnce(110); // smartMopMode
    const setting = new CleanModeSetting(0, 0, 0, 306, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting); // smartMopRoute = 306
    expect(mockClient.send).not.toHaveBeenCalled();
  });

  it('changeCleanMode should return early if customMopMode with customMopRoute', async () => {
    mockClient.get.mockResolvedValueOnce(106); // customMopMode
    const setting = new CleanModeSetting(0, 0, 0, 302, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting); // customMopRoute = 302
    expect(mockClient.send).not.toHaveBeenCalled();
  });

  it('changeCleanMode should switch from smart to custom mode first', async () => {
    mockClient.get.mockResolvedValueOnce(110); // smartMopMode

    const setting = new CleanModeSetting(101, 207, 0, 303, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_mop_mode',
      }),
    );
  });

  it('changeCleanMode should set suctionPower if non-zero', async () => {
    mockClient.get.mockResolvedValueOnce(106); // customMopMode

    const setting = new CleanModeSetting(101, 0, 0, 303, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
    expect(mockClient.send).toHaveBeenCalledWith(
      'duid',
      expect.objectContaining({
        method: 'set_custom_mode',
      }),
    );
  });

  it('changeCleanMode should set water_box_custom_mode with distance_off for CustomizeWithDistanceOff', async () => {
    mockClient.get.mockResolvedValueOnce(106);
    const setting = new CleanModeSetting(0, 207, 5, 0, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting); // 207 is CustomizeWithDistanceOff
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
    const setting = new CleanModeSetting(0, 200, 0, 0, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
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
    const setting = new CleanModeSetting(0, 0, 0, 303, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
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
    const setting = new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist);
    await processor.changeCleanMode('duid', setting);
    expect(mockClient.send).not.toHaveBeenCalled();
  });
});
