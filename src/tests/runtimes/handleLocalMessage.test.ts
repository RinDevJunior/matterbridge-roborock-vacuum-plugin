import { handleLocalMessage } from '../../runtimes/handleLocalMessage';
import { OperationStatusCode } from '../../roborockCommunication/Zenum/operationStatusCode';
import { ServiceArea, PowerSource } from 'matterbridge/matter/clusters';
import { cloudMessageResult1, cloudMessageResult2, cloudMessageResult3, mapInfo } from '../testData/mockData';
import { RoomIndexMap } from '../../model/roomIndexMap';

// Mocks
const mockUpdateAttribute = jest.fn();
const mockGetSupportedAreas = jest.fn();
const mockGetSupportedAreasIndexMap = jest.fn();
const mockGetRoomMap = jest.fn();

jest.mock('./src/helper', () => ({
  getRoomMap: mockGetRoomMap,
}));

const mockLog = {
  error: jest.fn(),
  debug: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  /* eslint-disable no-console */
  fatal: jest.fn().mockImplementation((message: string, ...arg: unknown[]) => console.info(message, ...arg)),
};

const getMockRobot = () => ({
  device: { data: { model: 'test-model' } },
  updateAttribute: mockUpdateAttribute,
  getAttribute: jest.fn(() => undefined),
});

describe('handleLocalMessage -- FF ON', () => {
  const getMockPlatform = (robotExists = true) => ({
    robots: new Map(robotExists ? [['duid1', getMockRobot()]] : []),
    log: mockLog,
    roborockService: {
      getSelectedAreas: jest.fn(() => ['area1']),
      getSupportedAreas: mockGetSupportedAreas,
      getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
      getMapInformation: jest.fn().mockReturnValue(mapInfo),
    },
    enableExperimentalFeature: {
      enableExperimentalFeature: true,
      advancedFeature: {
        enableMultipleMap: true,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 0 } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot with DUID duid1 not found.');
  });

  it('updates selectedAreas on Idle', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: OperationStatusCode.Idle } as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', ['area1'], mockLog);
  });

  it('updates currentArea and selectedAreas to null/[] when cleaning_info is missing', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: 5 } as any, platform as any, 'duid1');
    await new Promise(process.nextTick);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('updates battery attributes if battery present', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: 0, battery: 50 } as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 100, mockLog);
  });

  it('updates currentArea based on segment_id', async () => {
    const platform = getMockPlatform();

    // currentMappedAreas
    mockGetSupportedAreas.mockReturnValue([
      { areaId: 100, mapId: 0, areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 101, mapId: 0, areaInfo: { locationInfo: { locationName: 'Study', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 102, mapId: 0, areaInfo: { locationInfo: { locationName: 'Living room', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 103, mapId: 0, areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 104, mapId: 1, areaInfo: { locationInfo: { locationName: 'Dining room', floorNumber: 1, areaType: null }, landmarkInfo: null } },
      { areaId: 105, mapId: 1, areaInfo: { locationInfo: { locationName: 'Guest bedroom', floorNumber: 1, areaType: null }, landmarkInfo: null } },
      { areaId: 106, mapId: 1, areaInfo: { locationInfo: { locationName: 'Master bedroom', floorNumber: 1, areaType: null }, landmarkInfo: null } },
      { areaId: 107, mapId: 1, areaInfo: { locationInfo: { locationName: 'Balcony', floorNumber: 1, areaType: null }, landmarkInfo: null } },
      { areaId: 108, mapId: 1, areaInfo: { locationInfo: { locationName: 'Living room', floorNumber: 1, areaType: null }, landmarkInfo: null } },
    ]);

    const roomIndexMap = new RoomIndexMap(
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
    );

    // roomIndexMap
    mockGetSupportedAreasIndexMap.mockReturnValue(roomIndexMap);

    await handleLocalMessage(cloudMessageResult3, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('No cleaning_info'));

    await handleLocalMessage(cloudMessageResult1 as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 102, mockLog);

    await handleLocalMessage(cloudMessageResult2 as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 103, mockLog);
  });
});

describe('handleLocalMessage -- FF OFF', () => {
  const getMockPlatform = (robotExists = true) => ({
    robots: new Map(robotExists ? [['duid1', getMockRobot()]] : []),
    log: mockLog,
    roborockService: {
      getSelectedAreas: jest.fn(() => ['area1']),
      getSupportedAreas: mockGetSupportedAreas,
      getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
      getMapInformation: jest.fn().mockReturnValue(mapInfo),
    },
    enableExperimentalFeature: {
      enableExperimentalFeature: false,
      advancedFeature: {
        enableMultipleMap: false,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 0 } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot with DUID duid1 not found.');
  });

  it('updates selectedAreas on Idle', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: OperationStatusCode.Idle } as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', ['area1'], mockLog);
  });

  it('updates currentArea and selectedAreas to null/[] when cleaning_info is missing', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: 5 } as any, platform as any, 'duid1');
    await new Promise(process.nextTick);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('updates battery attributes if battery present', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage({ state: 0, battery: 50 } as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 100, mockLog);
  });

  it('updates currentArea based on segment_id', async () => {
    const platform = getMockPlatform();
    // currentMappedAreas
    mockGetSupportedAreas.mockReturnValue([
      { areaId: 1, mapId: 0, areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 2, mapId: 0, areaInfo: { locationInfo: { locationName: 'Study', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 3, mapId: 0, areaInfo: { locationInfo: { locationName: 'Living room', floorNumber: 0, areaType: null }, landmarkInfo: null } },
      { areaId: 4, mapId: 0, areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 0, areaType: null }, landmarkInfo: null } },
    ]);

    // roomIndexMap
    mockGetSupportedAreasIndexMap.mockReturnValue({
      indexMap: new Map([
        [1, { roomId: 1, mapId: 0 }],
        [2, { roomId: 2, mapId: 0 }],
        [3, { roomId: 3, mapId: 0 }],
        [4, { roomId: 4, mapId: 0 }],
      ]),
      roomMap: new Map([
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ]),

      getAreaId(roomId: number): { roomId: number; mapId: number } | undefined {
        const index = this.roomMap.get(roomId);
        if (index === undefined) {
          return undefined;
        }
        return { roomId: index, mapId: this.indexMap.get(index).mapId };
      },

      getRoomId(areaId: number): number | undefined {
        return this.indexMap.get(areaId)?.roomId;
      },
    });

    await handleLocalMessage(cloudMessageResult3 as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('No cleaning_info'));

    await handleLocalMessage(cloudMessageResult1 as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 3, mockLog);

    await handleLocalMessage(cloudMessageResult2 as any, platform as any, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 4, mockLog);
  });
});
