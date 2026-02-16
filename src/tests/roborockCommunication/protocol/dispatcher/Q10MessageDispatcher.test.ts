import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { asPartial, asType } from '../../../helpers/testUtils.js';
import { Q10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.js';
import { RequestMessage } from '../../../../roborockCommunication/models/index.js';
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
    connect: vi.fn(),
    disconnect: vi.fn(),
    registerConnectionListener: vi.fn(),
    registerMessageListener: vi.fn(),
  };
}

// --- Test Suite ---
describe('Q10MessageDispatcher', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let client: ReturnType<typeof createMockClient>;
  let dispatcher: Q10MessageDispatcher;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();
    client = createMockClient();
    dispatcher = new Q10MessageDispatcher(asType(logger), asType(client));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('getNetworkInfo', () => {
    it('should return undefined', async () => {
      const result = await dispatcher.getNetworkInfo(duid);
      expect(result).toBeUndefined();
    });
  });

  describe('getDeviceStatus', () => {
    it('should call client.get and return undefined', async () => {
      const result = await dispatcher.getDeviceStatus(duid);
      expect(client.get).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('getHomeMap', () => {
    it('should return an empty object', async () => {
      const result = await dispatcher.getHomeMap(duid);
      expect(result).toEqual({});
    });
  });

  describe('getMapInfo', () => {
    it('should call client.get and logger.notice, return MapInfo', async () => {
      client.get.mockResolvedValueOnce({});
      const result = await dispatcher.getMapInfo(duid);
      expect(client.get).toHaveBeenCalled();
      expect(logger.notice).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Object); // MapInfo, but type is not checked at runtime
    });
  });

  describe('getRoomMap', () => {
    it('should call client.get and return RoomMap', async () => {
      client.get.mockResolvedValueOnce({ room_mapping: [] });
      const result = await dispatcher.getRoomMap(duid, 1);
      expect(client.get).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Object); // RoomMap, but type is not checked at runtime
    });

    it('should return empty array when response has no room_mapping', async () => {
      client.get.mockResolvedValueOnce({});
      const result = await dispatcher.getRoomMap(duid, 1);
      expect(result).toEqual([]);
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
    it('should call resumeCleaning', async () => {
      const spy = vi.spyOn(dispatcher, 'resumeCleaning').mockResolvedValue(undefined);
      await dispatcher.resumeRoomCleaning(duid);
      expect(spy).toHaveBeenCalledWith(duid);
    });
  });

  describe('stopCleaning', () => {
    it('should send a stop command', async () => {
      await dispatcher.stopCleaning(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('findMyRobot', () => {
    it('should send a find_me command', async () => {
      await dispatcher.findMyRobot(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('sendCustomMessage', () => {
    it('should send a custom message', async () => {
      const def = asPartial<RequestMessage>({ toLocalRequest: vi.fn(), secure: false, isForProtocol: vi.fn(), version: '1.0', method: 'custom' });
      await dispatcher.sendCustomMessage(duid, def);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('getCustomMessage', () => {
    it('should get a custom message', async () => {
      const def = asPartial<RequestMessage>({ dps: { foo: 'bar' } });
      await dispatcher.getCustomMessage(duid, def);
      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('getCleanModeData', () => {
    it('should return a CleanModeSetting object', async () => {
      const result = await dispatcher.getCleanModeData(duid);
      expect(result).toEqual({ suctionPower: 0, waterFlow: 0, mopRoute: 0, distance_off: 0, sequenceType: 0 });
    });
  });

  describe('messageId', () => {
    it('should return monotonically increasing IDs', () => {
      const id1 = dispatcher['messageId'];
      const id2 = dispatcher['messageId'];
      expect(id2).toBeGreaterThan(id1);
    });

    it('should increment when Date.now returns same value', () => {
      const fixedTime = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
      dispatcher['lastB01Id'] = fixedTime;
      const id = dispatcher['messageId'];
      expect(id).toBe(fixedTime + 1);
      vi.restoreAllMocks();
    });
  });

  describe('changeCleanMode', () => {
    it('should call setCleanMode, setVacuumMode, setWaterMode as needed', async () => {
      const setCleanMode = vi.fn();
      const setVacuumMode = vi.fn();
      const setWaterMode = vi.fn();

      dispatcher['setCleanMode'] = setCleanMode;
      dispatcher['setVacuumMode'] = setVacuumMode;
      dispatcher['setWaterMode'] = setWaterMode;

      const setting = new CleanModeSetting(1, 2, 4, 3, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(setCleanMode).toHaveBeenCalledWith(duid, 1, 2);
      expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
      expect(setWaterMode).toHaveBeenCalledWith(duid, 2);
    });
    it('should not call setVacuumMode if suctionPower is 0', async () => {
      const setCleanMode = vi.fn();
      const setVacuumMode = vi.fn();
      const setWaterMode = vi.fn();

      dispatcher['setCleanMode'] = setCleanMode;
      dispatcher['setVacuumMode'] = setVacuumMode;
      dispatcher['setWaterMode'] = setWaterMode;

      const setting = new CleanModeSetting(0, 2, 4, 3, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(setVacuumMode).not.toHaveBeenCalled();
      expect(setWaterMode).toHaveBeenCalledWith(duid, 2);
    });
    it('should not call setWaterMode if waterFlow is 0', async () => {
      const setCleanMode = vi.fn();
      const setVacuumMode = vi.fn();
      const setWaterMode = vi.fn();

      dispatcher['setCleanMode'] = setCleanMode;
      dispatcher['setVacuumMode'] = setVacuumMode;
      dispatcher['setWaterMode'] = setWaterMode;

      const setting = new CleanModeSetting(1, 0, 4, 3, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
      expect(setWaterMode).not.toHaveBeenCalled();
    });

    it('should call real private helpers and send commands via client', async () => {
      const setting = new CleanModeSetting(2, 3, 4, 1, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      // setCleanMode + setVacuumMode + setWaterMode = 3 sends
      expect(client.send).toHaveBeenCalledTimes(3);
      expect(logger.notice).toHaveBeenCalledWith(expect.stringContaining('Change clean mode'));
    });

    it('should only call setCleanMode when both suctionPower and waterFlow are 0', async () => {
      const setting = new CleanModeSetting(0, 0, 4, 1, CleanSequenceType.Persist);
      await dispatcher.changeCleanMode(duid, setting);
      expect(client.send).toHaveBeenCalledTimes(1);
    });
  });
});
