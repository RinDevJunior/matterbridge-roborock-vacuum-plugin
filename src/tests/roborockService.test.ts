import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import RoborockService from '../roborockService';
import { MessageProcessor } from '../roborockCommunication/broadcast/messageProcessor';

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
});
