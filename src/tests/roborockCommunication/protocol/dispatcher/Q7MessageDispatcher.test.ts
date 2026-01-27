import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Q7MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.js';
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
describe('Q7MessageDispatcher', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let client: ReturnType<typeof createMockClient>;
  let dispatcher: Q7MessageDispatcher;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();
    client = createMockClient();
    dispatcher = new Q7MessageDispatcher(logger as any, client as any);
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
    it('should return undefined', async () => {
      const result = await dispatcher.getDeviceStatus(duid);
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
    it('should call client.get and logger.notice, return RoomMap', async () => {
      client.get.mockResolvedValueOnce([]);
      const result = await dispatcher.getRoomMap(duid, 1, []);
      expect(client.get).toHaveBeenCalled();
      expect(logger.notice).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Object); // RoomMap, but type is not checked at runtime
    });
  });

  describe('goHome', () => {
    it('should send a charge command', async () => {
      await dispatcher.goHome(duid);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('startCleaning', () => {
    it('should call startRoomCleaning with empty roomIds and repeat 1', async () => {
      const spy = vi.spyOn(dispatcher, 'startRoomCleaning').mockResolvedValue(undefined);
      await dispatcher.startCleaning(duid);
      expect(spy).toHaveBeenCalledWith(duid, [], 1);
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
    it('should call startCleaning', async () => {
      const spy = vi.spyOn(dispatcher, 'startCleaning').mockResolvedValue(undefined);
      await dispatcher.resumeCleaning(duid);
      expect(spy).toHaveBeenCalledWith(duid);
    });
  });

  describe('resumeRoomCleaning', () => {
    it('should call startRoomCleaning with empty roomIds and repeat 1', async () => {
      const spy = vi.spyOn(dispatcher, 'startRoomCleaning').mockResolvedValue(undefined);
      await dispatcher.resumeRoomCleaning(duid);
      expect(spy).toHaveBeenCalledWith(duid, [], 1);
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
      const def = { dps: { foo: 'bar' } } as any;
      await dispatcher.sendCustomMessage(duid, def);
      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('getCustomMessage', () => {
    it('should get a custom message', async () => {
      const def = { dps: { foo: 'bar' } } as any;
      await dispatcher.getCustomMessage(duid, def);
      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('getCleanModeData', () => {
    it('should return a CleanModeSetting object', async () => {
      const result = await dispatcher.getCleanModeData(duid);
      expect(result).toEqual({ suctionPower: 2, waterFlow: 2, mopRoute: 0, distance_off: 0 });
    });
  });

  describe('changeCleanMode', () => {
    it('should call setCleanMode, setVacuumMode, setMopMode as needed', async () => {
      const setCleanMode = vi.spyOn(dispatcher, 'setCleanMode' as any).mockResolvedValue(undefined);
      const setVacuumMode = vi.spyOn(dispatcher, 'setVacuumMode' as any).mockResolvedValue(undefined);
      const setMopMode = vi.spyOn(dispatcher, 'setMopMode' as any).mockResolvedValue(undefined);
      await dispatcher.changeCleanMode(duid, 1, 2, 3, 4);
      expect(setCleanMode).toHaveBeenCalledWith(duid, 1, 2);
      expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
      expect(setMopMode).toHaveBeenCalledWith(duid, 2);
    });
    it('should not call setVacuumMode if suctionPower is 0', async () => {
      const setCleanMode = vi.spyOn(dispatcher, 'setCleanMode' as any).mockResolvedValue(undefined);
      const setVacuumMode = vi.spyOn(dispatcher, 'setVacuumMode' as any).mockResolvedValue(undefined);
      const setMopMode = vi.spyOn(dispatcher, 'setMopMode' as any).mockResolvedValue(undefined);
      await dispatcher.changeCleanMode(duid, 0, 2, 3, 4);
      expect(setVacuumMode).not.toHaveBeenCalled();
      expect(setMopMode).toHaveBeenCalledWith(duid, 2);
    });
    it('should not call setMopMode if waterFlow is 0', async () => {
      const setCleanMode = vi.spyOn(dispatcher, 'setCleanMode' as any).mockResolvedValue(undefined);
      const setVacuumMode = vi.spyOn(dispatcher, 'setVacuumMode' as any).mockResolvedValue(undefined);
      const setMopMode = vi.spyOn(dispatcher, 'setMopMode' as any).mockResolvedValue(undefined);
      await dispatcher.changeCleanMode(duid, 1, 0, 3, 4);
      expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
      expect(setMopMode).not.toHaveBeenCalled();
    });
  });

  describe('setCleanRoute', () => {
    it('should send a set_prop command for clean_path_preference', async () => {
      await dispatcher.setCleanRoute(duid, 1);
      expect(client.send).toHaveBeenCalled();
    });
  });
});
