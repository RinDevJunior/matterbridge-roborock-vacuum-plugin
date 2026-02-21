import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { asType } from '../../../testUtils.js';
import { V10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/V10MessageDispatcher.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

// --- Mock Factories ---
function createMockLogger() {
  return {
    notice: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockClient() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    isReady: vi.fn().mockReturnValue(true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    registerConnectionListener: vi.fn(),
    registerMessageListener: vi.fn(),
  };
}

// --- Test Suite ---
describe('V10MessageDispatcher', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let client: ReturnType<typeof createMockClient>;
  let dispatcher: V10MessageDispatcher;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();
    client = createMockClient();
    dispatcher = new V10MessageDispatcher(asType(logger), client);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('getNetworkInfo', () => {
    it('should call client.get', async () => {
      await dispatcher.getNetworkInfo(duid);
      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('getDeviceStatus', () => {
    it('should call client.get and return DeviceStatus if response', async () => {
      client.get.mockResolvedValueOnce([{ foo: 'bar' }]);
      const result = await dispatcher.getDeviceStatus(duid);
      expect(client.get).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Object); // DeviceStatus
    });
    it('should return undefined if no response', async () => {
      client.get.mockResolvedValueOnce(undefined);
      const result = await dispatcher.getDeviceStatus(duid);
      expect(result).toBeUndefined();
    });
  });

  describe('getHomeMap', () => {
    it('should call client.get and return response or {}', async () => {
      client.get.mockResolvedValueOnce({ map: 1 });
      const result = await dispatcher.getHomeMap(duid);
      expect(client.get).toHaveBeenCalled();
      expect(result).toEqual({ map: 1 });
    });
    it('should return {} if no response', async () => {
      client.get.mockResolvedValueOnce(undefined);
      const result = await dispatcher.getHomeMap(duid);
      expect(result).toEqual({});
    });
  });

  describe('getMapInfo', () => {
    it('should call client.get and return MapInfo', async () => {
      client.get.mockResolvedValueOnce([{ max_multi_map: 1, max_bak_map: 2, multi_map_count: 3, map_info: [] }]);
      const result = await dispatcher.getMapInfo(duid);
      expect(client.get).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Object); // MapInfo
    });
    it('should return default MapInfo if no response', async () => {
      client.get.mockResolvedValueOnce(undefined);
      const result = await dispatcher.getMapInfo(duid);
      expect(result).toBeInstanceOf(Object); // MapInfo
    });
  });

  describe('getRoomMap', () => {
    it('should call client.get and logger.debug, return RoomMap', async () => {
      client.get.mockResolvedValueOnce([
        [1, 2],
        [3, 4],
      ]);
      const result = await dispatcher.getRoomMap(duid, 1);
      expect(client.get).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Array); // RoomMap
    });
  });

  describe('goHome', () => {
    it('should send a charge command', async () => {
      await dispatcher.goHome(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('startCleaning', () => {
    it('should send a start cleaning command', async () => {
      await dispatcher.startCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('startRoomCleaning', () => {
    it('should send a start room cleaning command', async () => {
      await dispatcher.startRoomCleaning(duid, [1, 2], 2);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('pauseCleaning', () => {
    it('should send a pause command', async () => {
      await dispatcher.pauseCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('resumeCleaning', () => {
    it('should send a resume command', async () => {
      await dispatcher.resumeCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('resumeRoomCleaning', () => {
    it('should send a resume_segment_clean command', async () => {
      await dispatcher.resumeRoomCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('stopCleaning', () => {
    it('should send a stop command', async () => {
      await dispatcher.stopCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('findMyRobot', () => {
    it('should call client.get with find_me', async () => {
      await dispatcher.findMyRobot(duid);
      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('sendCustomMessage', () => {
    it('should send a custom message', async () => {
      const def = { method: 'foo' };
      await dispatcher.sendCustomMessage(duid, asType(def));
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('getCustomMessage', () => {
    it('should get a custom message', async () => {
      const def = { method: 'foo' };
      await dispatcher.getCustomMessage(duid, asType(def));
      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('getCleanModeData', () => {
    it('should call getCustomMessage and return CleanModeSetting', async () => {
      client.get.mockResolvedValueOnce([1]); // get_mop_mode
      client.get.mockResolvedValueOnce([2]); // get_custom_mode
      client.get.mockResolvedValueOnce({ water_box_mode: 3, distance_off: 4 }); // get_water_box_custom_mode
      const result = await dispatcher.getCleanModeData(duid);
      expect(client.get).toHaveBeenCalled();
      expect(result).toEqual({ suctionPower: 2, waterFlow: 3, distance_off: 4, mopRoute: 1 });
    });
    it('should handle array and non-array responses', async () => {
      client.get.mockResolvedValueOnce(5); // get_mop_mode
      client.get.mockResolvedValueOnce(6); // get_custom_mode
      client.get.mockResolvedValueOnce(7); // get_water_box_custom_mode
      const result = await dispatcher.getCleanModeData(duid);
      expect(result).toEqual({ suctionPower: 6, waterFlow: 7, distance_off: 0, mopRoute: 5 });
    });
  });

  describe('changeCleanMode', () => {
    it('should early return for smart plan', async () => {
      client.get.mockResolvedValueOnce(110); // get_custom_mode

      const setting = new CleanModeSetting(1, 2, 0, 306, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).not.toHaveBeenCalled();
    });
    it('should early return for custom plan', async () => {
      client.get.mockResolvedValueOnce(106); // get_custom_mode

      const setting = new CleanModeSetting(1, 2, 0, 302, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).not.toHaveBeenCalled();
    });
    it('should send set_mop_mode if currentMopMode == smartMopMode', async () => {
      client.get.mockResolvedValueOnce(110); // get_custom_mode

      const setting = new CleanModeSetting(1, 2, 0, 100, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledWith(duid, expect.objectContaining({ method: 'set_mop_mode' }));
    });
    it('should send set_custom_mode if suctionPower != 0', async () => {
      client.get.mockResolvedValueOnce(0); // get_custom_mode

      const setting = new CleanModeSetting(5, 0, 0, 0, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledWith(duid, expect.objectContaining({ method: 'set_custom_mode' }));
    });
    it('should send set_water_box_custom_mode with distance_off', async () => {
      client.get.mockResolvedValueOnce(0); // get_custom_mode
      const setting = new CleanModeSetting(0, 207, 10, 0, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledWith(
        duid,
        expect.objectContaining({
          method: 'set_water_box_custom_mode',
          params: { water_box_mode: 207, distance_off: 10 },
        }),
      );
    });
    it('should send set_water_box_custom_mode with array param', async () => {
      client.get.mockResolvedValueOnce(0); // get_custom_mode

      const setting = new CleanModeSetting(0, 5, 0, 0, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledWith(
        duid,
        expect.objectContaining({ method: 'set_water_box_custom_mode', params: [5] }),
      );
    });
    it('should send set_mop_mode if mopRoute != 0', async () => {
      client.get.mockResolvedValueOnce(0); // get_custom_mode

      const setting = new CleanModeSetting(0, 0, 0, 8, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledWith(duid, expect.objectContaining({ method: 'set_mop_mode', params: [8] }));
    });
  });
});
