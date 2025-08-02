import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../roborockService';
import { MessageProcessor } from '../roborockCommunication/broadcast/messageProcessor';
import { RoomIndexMap } from '../model/roomIndexMap';

describe('RoborockService - startClean', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;
  let mockLoginApi: any;
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

    roborockService = new RoborockService(() => mockLoginApi, jest.fn(), 10, {} as any, mockLogger);
    roborockService['auth'] = jest.fn((ud) => ud);
    roborockService['messageProcessorMap'] = new Map<string, MessageProcessor>([['test-duid', mockMessageProcessor]]);

    mockIotApi = { getCustom: jest.fn() };
    roborockService['iotApi'] = mockIotApi;
  });

  it('setSelectedAreas should set selected areas', () => {
    roborockService.setSupportedAreaIndexMap(
      'duid',
      new RoomIndexMap(
        new Map([
          [100, { roomId: 1, mapId: 0 }],
          [101, { roomId: 2, mapId: 0 }],
          [102, { roomId: 3, mapId: 0 }],
          [103, { roomId: 4, mapId: 0 }],
          [104, { roomId: 1, mapId: 1 }],
          [105, { roomId: 2, mapId: 1 }],
          [106, { roomId: 3, mapId: 1 }],
          [107, { roomId: 4, mapId: 1 }],
          [108, { roomId: 5, mapId: 1 }],
        ]),
      ),
    );
    roborockService.setSelectedAreas('duid', [106, 108]);

    expect(roborockService['selectedAreas'].get('duid')).toEqual([3, 5]);
    expect(mockLogger.debug).toHaveBeenCalledWith('RoborockService - setSelectedAreas - roomIds', [3, 5]);
  });
});
