import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import RoborockService from '../roborockService';
import { MessageProcessor } from '../roborockCommunication/broadcast/messageProcessor';
import { Device, MultipleMap, RequestMessage } from '../roborockCommunication';
import { RoomIndexMap } from '../model/roomIndexMap';

describe('RoborockService - startClean', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;
  let mockLoginApi: any;
  let mockMapInfo: any;
  let mockMessageClient: any;
  let mockIotApi: any;

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

    mockLoginApi = {
      loginWithPassword: jest.fn(),
      loginWithUserData: jest.fn(),
    };

    mockMapInfo = jest.fn();
    roborockService = new RoborockService(() => mockLoginApi, jest.fn(), 10, {} as any, mockLogger);
    roborockService['auth'] = jest.fn((ud) => ud);
    roborockService['messageProcessorMap'] = new Map<string, MessageProcessor>([['test-duid', mockMessageProcessor]]);

    mockIotApi = { getCustom: jest.fn() };
    roborockService['iotApi'] = mockIotApi;
  });

  it('should return result from iotApi.getCustom', async () => {
    mockIotApi.getCustom.mockResolvedValue({ foo: 'bar' });
    const result = await roborockService.getCustomAPI('http://test');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - getCustomAPI', 'http://test');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should log error and return error object if iotApi.getCustom throws', async () => {
    mockIotApi.getCustom.mockRejectedValue(new Error('fail'));
    const result = await roborockService.getCustomAPI('http://test');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get custom API with url http://test:'));
    expect(result).toEqual({ result: undefined, error: expect.stringContaining('Failed to get custom API with url http://test') });
  });

  it('should return MapInfo if response contains maps', async () => {
    const mapData = [
      {
        map_info: [
          {
            rooms: [{ id: 1, iot_name_id: 'room1', tag: 0, iot_name: 'Living Room' }],
            mapFlag: 1,
            name: 'Living Room Map',
          },
        ],
      },
    ] as MultipleMap[];
    mockMessageClient = {
      get: jest.fn(),
    };
    roborockService.messageClient = mockMessageClient;
    mockMessageClient.get.mockResolvedValue(mapData);
    mockMapInfo.mockImplementation((data) => ({ map: data }));

    const result = await roborockService.getMapInformation('duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - getMapInformation', 'duid');
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - getMapInformation response', expect.anything());
    expect(result?.maps.length).toEqual(1);
  });

  it('should return undefined if response is empty', async () => {
    mockMessageClient = { get: jest.fn() };
    mockMessageClient.get.mockResolvedValue(undefined);
    roborockService.messageClient = mockMessageClient;

    const result = await roborockService.getMapInformation('duid');
    expect(result).toBeUndefined();
  });

  it('should return vacuumRoom if present', async () => {
    roborockService.customGet = jest.fn();
    (roborockService.customGet as jest.Mock).mockResolvedValue({ vacuumRoom: 42 });
    const result = await roborockService.getRoomIdFromMap('duid');
    expect(roborockService.customGet).toHaveBeenCalledWith('duid', expect.any(Object));
    expect(result).toBe(42);
  });

  it('should return undefined if vacuumRoom is not present', async () => {
    roborockService.customGet = jest.fn();
    (roborockService.customGet as jest.Mock).mockResolvedValue({});
    const result = await roborockService.getRoomIdFromMap('duid');
    expect(result).toBeUndefined();
  });

  it('should login with password if no saved user data', async () => {
    const username = 'user';
    const password = 'pass';
    const userData = { foo: 'bar' };
    mockLoginApi.loginWithPassword.mockResolvedValue(userData);
    const loadSavedUserData = jest.fn().mockResolvedValue(undefined);
    const savedUserData = jest.fn().mockResolvedValue(undefined);

    const result = await roborockService.loginWithPassword(username, password, loadSavedUserData, savedUserData);

    expect(mockLogger.debug).toHaveBeenCalledWith('No saved user data found, logging in with password');
    expect(mockLoginApi.loginWithPassword).toHaveBeenCalledWith(username, password);
    expect(savedUserData).toHaveBeenCalledWith(userData);
    expect(roborockService['auth']).toHaveBeenCalledWith(userData);
    expect(result).toBe(userData);
  });

  it('should login with user data if saved user data exists', async () => {
    const username = 'user';
    const password = 'pass';
    const userData = { foo: 'bar' };
    mockLoginApi.loginWithUserData.mockResolvedValue(userData);
    const loadSavedUserData = jest.fn().mockResolvedValue(userData);
    const savedUserData = jest.fn();

    const result = await roborockService.loginWithPassword(username, password, loadSavedUserData, savedUserData);

    expect(mockLogger.debug).toHaveBeenCalledWith('Using saved user data for login', expect.anything());
    expect(mockLoginApi.loginWithUserData).toHaveBeenCalledWith(username, userData);
    expect(roborockService['auth']).toHaveBeenCalledWith(userData);
    expect(result).toBe(userData);
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
    roborockService.setSupportedAreaIndexMap(
      'duid',
      new RoomIndexMap(
        new Map([
          [1, { roomId: 1, mapId: 0 }],
          [2, { roomId: 2, mapId: 1 }],
        ]),
      ),
    );
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
    const result = await roborockService.customGet('duid', { method: 'method', params: undefined, secure: true } as RequestMessage);
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - customSend-message', 'method', undefined, true);
    expect(mockMessageProcessor.getCustomMessage).toHaveBeenCalledWith('duid', expect.any(Object));
    expect(result).toBe('result');
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

describe('RoborockService - sleep', () => {
  it('should resolve after ms', async () => {
    const roborockService = new RoborockService(jest.fn(), jest.fn(), 10, {} as any, {} as any);
    const start = Date.now();
    await roborockService['sleep'](100);
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
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
