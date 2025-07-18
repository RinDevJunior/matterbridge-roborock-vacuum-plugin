import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import RoborockService from '../roborockService';
import { MessageProcessor } from '../roborockCommunication/broadcast/messageProcessor';
import { Device } from '../roborockCommunication';

describe('RoborockService - startClean', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      notice: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockMessageProcessor = {
      startClean: jest.fn(),
      startRoomClean: jest.fn(),
    } as any;

    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService['messageProcessorMap'] = new Map<string, MessageProcessor>([['test-duid', mockMessageProcessor]]);
  });

  it('should start global clean when no areas or selected areas are provided', async () => {
    const duid = 'test-duid';
    roborockService['supportedAreas'].set(duid, []);
    roborockService['selectedAreas'].set(duid, []);

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startGlobalClean');
    expect(mockMessageProcessor.startClean).toHaveBeenCalledWith(duid);
  });

  it('should start room clean when selected areas match supported areas', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
    ];
    const selectedAreas = [1];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startRoomClean', expect.anything());
    expect(mockMessageProcessor.startRoomClean).toHaveBeenCalledWith(duid, selectedAreas, 1);
  });

  it('should start global clean when all selected areas match all supported areas', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
    ];
    const selectedAreas = [1, 2];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startGlobalClean');
    expect(mockMessageProcessor.startClean).toHaveBeenCalledWith(duid);
  });

  it('should start scene when a routine is selected', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
    ];
    const supportedRoutines: ServiceArea.Area[] = [{ areaId: 99, mapId: null, areaInfo: {} as any }];
    const selectedAreas = [99];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['supportedRoutines'].set(duid, supportedRoutines);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    roborockService['iotApi'] = {
      startScene: jest.fn(),
    } as any;

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startScene', expect.anything());
    expect(roborockService['iotApi']!.startScene).toHaveBeenCalledWith(99);
  });

  it('should warn when multiple routines are selected', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
    ];
    const supportedRoutines: ServiceArea.Area[] = [
      { areaId: 99, mapId: null, areaInfo: {} as any },
      { areaId: 100, mapId: null, areaInfo: {} as any },
    ];
    const selectedAreas = [99, 100];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['supportedRoutines'].set(duid, supportedRoutines);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    await roborockService.startClean(duid);

    expect(mockLogger.warn).toHaveBeenCalledWith('RoborockService - Multiple routines selected, which is not supported.', expect.anything());
  });

  it('should start global clean if all selected rooms match supportedRooms even with routines defined', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
    ];
    const supportedRoutines: ServiceArea.Area[] = [{ areaId: 99, mapId: null, areaInfo: {} as any }];
    const selectedAreas = [1, 2];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['supportedRoutines'].set(duid, supportedRoutines);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startGlobalClean');
    expect(mockMessageProcessor.startClean).toHaveBeenCalledWith(duid);
  });

  it('should start room clean if only rooms are selected and not all rooms', async () => {
    const duid = 'test-duid';
    const supportedAreas: ServiceArea.Area[] = [
      { areaId: 1, mapId: null, areaInfo: {} as any },
      { areaId: 2, mapId: null, areaInfo: {} as any },
      { areaId: 3, mapId: null, areaInfo: {} as any },
    ];
    const supportedRoutines: ServiceArea.Area[] = [{ areaId: 99, mapId: null, areaInfo: {} as any }];
    const selectedAreas = [1, 3];

    roborockService['supportedAreas'].set(duid, supportedAreas);
    roborockService['supportedRoutines'].set(duid, supportedRoutines);
    roborockService['selectedAreas'].set(duid, selectedAreas);

    await roborockService.startClean(duid);

    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - startRoomClean', expect.anything());
    expect(mockMessageProcessor.startRoomClean).toHaveBeenCalledWith(duid, [1, 3], 1);
  });

  it('should initialize and store MessageProcessor for the given duid', () => {
    const duid = 'test-duid';
    roborockService.initializeMessageClientForLocal({ duid } as Device);
    const storedProcessor = roborockService['messageProcessorMap'].get(duid);
    expect(storedProcessor).not.toBeUndefined();
  });
});

describe('RoborockService - basic setters/getters', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
  });

  it('setSelectedAreas should set selected areas', () => {
    roborockService.setSelectedAreas('duid', [1, 2]);
    expect(roborockService['selectedAreas'].get('duid')).toEqual([1, 2]);
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - setSelectedAreas', [1, 2]);
  });

  it('setSupportedAreas should set supported areas', () => {
    const areas = [{ areaId: 1, mapId: null, areaInfo: {} as any }];
    roborockService.setSupportedAreas('duid', areas);
    expect(roborockService['supportedAreas'].get('duid')).toEqual(areas);
  });

  it('setSupportedScenes should set supported routines', () => {
    const routines = [{ areaId: 99, mapId: null, areaInfo: {} as any }];
    roborockService.setSupportedScenes('duid', routines);
    expect(roborockService['supportedRoutines'].get('duid')).toEqual(routines);
  });

  it('getSupportedAreas should return supported areas', () => {
    const areas = [{ areaId: 1, mapId: null, areaInfo: {} as any }];
    roborockService['supportedAreas'].set('duid', areas);
    expect(roborockService.getSupportedAreas('duid')).toEqual(areas);
  });
});

describe('RoborockService - getMessageProcessor', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageProcessor = { startClean: jest.fn() } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
  });

  it('should return processor if present', () => {
    roborockService['messageProcessorMap'].set('duid', mockMessageProcessor);
    expect(roborockService.getMessageProcessor('duid')).toBe(mockMessageProcessor);
  });

  it('should log error if processor not present', () => {
    expect(roborockService.getMessageProcessor('unknown')).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('MessageApi is not initialized.');
  });
});

describe('RoborockService - getCleanModeData', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageProcessor = { getCleanModeData: jest.fn() } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService['messageProcessorMap'].set('duid', mockMessageProcessor);
  });

  it('should return clean mode data', async () => {
    mockMessageProcessor.getCleanModeData.mockResolvedValue({ suctionPower: 1, waterFlow: 2, distance_off: 3, mopRoute: 4 });
    const result = await roborockService.getCleanModeData('duid');
    expect(result).toEqual({ suctionPower: 1, waterFlow: 2, distance_off: 3, mopRoute: 4 });
    expect(mockLogger.notice).toHaveBeenCalledWith('RoborockService - getCleanModeData');
  });
});

describe('RoborockService - changeCleanMode', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageProcessor = { changeCleanMode: jest.fn() } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService['messageProcessorMap'].set('duid', mockMessageProcessor);
  });

  it('should call changeCleanMode on processor', async () => {
    await roborockService.changeCleanMode('duid', { suctionPower: 1, waterFlow: 2, distance_off: 3, mopRoute: 4 });
    expect(mockLogger.notice).toHaveBeenCalledWith('RoborockService - changeCleanMode');
    expect(mockMessageProcessor.changeCleanMode).toHaveBeenCalledWith('duid', 1, 2, 4, 3);
  });
});

describe('RoborockService - pause/stop/resume/playSound', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageProcessor = {
      pauseClean: jest.fn(),
      gotoDock: jest.fn(),
      resumeClean: jest.fn(),
      findMyRobot: jest.fn(),
    } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService['messageProcessorMap'].set('duid', mockMessageProcessor);
  });

  it('pauseClean should call processor and log', async () => {
    await roborockService.pauseClean('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - pauseClean');
    expect(mockMessageProcessor.pauseClean).toHaveBeenCalledWith('duid');
  });

  it('stopAndGoHome should call processor and log', async () => {
    await roborockService.stopAndGoHome('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - stopAndGoHome');
    expect(mockMessageProcessor.gotoDock).toHaveBeenCalledWith('duid');
  });

  it('resumeClean should call processor and log', async () => {
    await roborockService.resumeClean('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - resumeClean');
    expect(mockMessageProcessor.resumeClean).toHaveBeenCalledWith('duid');
  });

  it('playSoundToLocate should call processor and log', async () => {
    await roborockService.playSoundToLocate('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - findMe');
    expect(mockMessageProcessor.findMyRobot).toHaveBeenCalledWith('duid');
  });
});

describe('RoborockService - customGet/customGetInSecure/customSend', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageProcessor = {
      getCustomMessage: jest.fn(),
      sendCustomMessage: jest.fn(),
    } as any;
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService['messageProcessorMap'].set('duid', mockMessageProcessor);
  });

  it('customGet should call getCustomMessage', async () => {
    mockMessageProcessor.getCustomMessage.mockResolvedValue('result');
    const result = await roborockService.customGet('duid', 'method');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - customSend-message', 'method');
    expect(mockMessageProcessor.getCustomMessage).toHaveBeenCalledWith('duid', expect.any(Object));
    expect(result).toBe('result');
  });

  it('customGetInSecure should call getCustomMessage with secure', async () => {
    mockMessageProcessor.getCustomMessage.mockResolvedValue('secureResult');
    const result = await roborockService.customGetInSecure('duid', 'method');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - customGetInSecure-message', 'method');
    expect(mockMessageProcessor.getCustomMessage).toHaveBeenCalledWith('duid', expect.objectContaining({ secure: true }));
    expect(result).toBe('secureResult');
  });

  it('customSend should call sendCustomMessage', async () => {
    const req = { foo: 'bar' } as any;
    await roborockService.customSend('duid', req);
    expect(mockMessageProcessor.sendCustomMessage).toHaveBeenCalledWith('duid', req);
  });
});

describe('RoborockService - stopService', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageClient: any;
  let mockLocalClient: any;
  let mockMessageProcessor: any;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), notice: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
    mockMessageClient = { disconnect: jest.fn() };
    mockLocalClient = { disconnect: jest.fn(), isConnected: jest.fn() };
    mockMessageProcessor = {};
    roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, mockLogger);
    roborockService.messageClient = mockMessageClient;
    roborockService.localClientMap.set('duid', mockLocalClient);
    roborockService.messageProcessorMap.set('duid', mockMessageProcessor);
    roborockService.requestDeviceStatusInterval = setInterval(() => {
      jest.fn();
    }, 1000);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should disconnect messageClient, localClient, remove processors, clear interval', () => {
    roborockService.stopService();
    expect(mockMessageClient.disconnect).toHaveBeenCalled();
    expect(mockLocalClient.disconnect).toHaveBeenCalled();
    expect(roborockService.localClientMap.size).toBe(0);
    expect(roborockService.messageProcessorMap.size).toBe(0);
    expect(roborockService.requestDeviceStatusInterval).toBeUndefined();
  });
});

describe('RoborockService - setDeviceNotify', () => {
  it('should set deviceNotify callback', () => {
    const roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, {} as any);
    const cb = jest.fn();
    roborockService.setDeviceNotify(cb);
    expect(roborockService.deviceNotify).toBe(cb);
  });
});

describe('RoborockService - auth', () => {
  it('should set userdata and iotApi', () => {
    const mockLogger = {} as any;
    const mockIotApiFactory = jest.fn().mockReturnValue('iotApi');
    const roborockService = new RoborockService(jest.fn(), mockIotApiFactory, 10, {} as any, mockLogger);
    const userData = { foo: 'bar' } as any;
    const result = roborockService['auth'](userData);
    expect(roborockService['userdata']).toBe(userData);
    expect(roborockService['iotApi']).toBe('iotApi');
    expect(result).toBe(userData);
  });
});
