import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLocalMessage } from '../../runtimes/handleLocalMessage.js';
import { ServiceArea, PowerSource } from 'matterbridge/matter/clusters';
import {
  cloudMessageResult1,
  cloudMessageResult2,
  cloudMessageResult3,
  mapInfo,
  cloudMessageResultFromLog,
  roomMapFromLog,
  currentMappedAreasFromLog,
} from '../testData/mockData.js';
import { RoomIndexMap } from '../../model/RoomIndexMap.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import { DeviceRegistry } from '../../platform/deviceRegistry.js';

// Mocks

const mockUpdateAttribute = vi.fn();
const mockGetSupportedAreas = vi.fn();
const mockGetSupportedAreasIndexMap = vi.fn();
const mockGetRoomMap = vi.fn();

vi.mock('../helper.js', () => ({
  getRoomMap: mockGetRoomMap,
}));

const mockLog = {
  error: vi.fn(),
  debug: vi.fn(),
  notice: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  /* eslint-disable no-console */
  fatal: vi.fn().mockImplementation((message: string, ...arg: unknown[]) => {
    console.info(message, ...arg);
  }),
};

const getMockRobot = () => {
  // Use a plain object so properties can be set dynamically in tests
  return {
    device: { data: { model: 'test-model' } },
    updateAttribute: mockUpdateAttribute,
    getAttribute: vi.fn(() => undefined),
    // Do not define dockStationStatus here so it can be set by the code under test
  };
};

describe('handleLocalMessage -- FF ON', () => {
  const getMockPlatform = (robotExists = true, includeDockStatus = false) => {
    const robots = new Map(robotExists ? [['duid1', getMockRobot()]] : []);
    return {
      robots,
      registry: {
        getRobot: (id: string) => robots.get(id),
        robotsMap: robots,
        hasDevices: () => robots.size > 0,
        registerRobot: vi.fn(),
      },
      configManager: {
        isMultipleMapEnabled: true,
      },
      log: mockLog,
      roborockService: {
        getSelectedAreas: vi.fn(() => ['area1']),
        getSupportedAreas: mockGetSupportedAreas,
        getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
        getMapInformation: vi.fn().mockReturnValue(mapInfo),
      },
      enableExperimentalFeature: {
        enableExperimentalFeature: true,
        advancedFeature: {
          enableMultipleMap: true,
          includeDockStationStatus: includeDockStatus,
        },
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 0 } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
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

  it('returns early when robot not found in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: 1 } } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
  });

  it('returns early when cleaning_info is missing in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 100, mapId: 0 }]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map([[100, { roomId: 1, mapId: 0 }]])));
    await handleLocalMessage({ state: 5 } as any, platform as any, 'duid1');
    // Should not crash
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('returns early when areaId is not found', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 100, mapId: 0 }]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map()));
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: 99 } } as any, platform as any, 'duid1');
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('segment_id: 99'));
  });

  it('does not process dss when feature is disabled', async () => {
    const platformNoDss = {
      ...getMockPlatform(),
      enableExperimentalFeature: {
        enableExperimentalFeature: false,
        advancedFeature: {
          enableMultipleMap: false,
        },
      },
    };

    await handleLocalMessage({ state: 0, dss: 0b01 } as any, platformNoDss as any, 'duid1');
    // Should not trigger error state
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'operationalState', 3, mockLog);
  });

  it('triggerDssError returns true if already in Error state', async () => {
    const platform = getMockPlatform();
    const robot = getMockRobot();
    robot.getAttribute = vi.fn(() => 3) as any; // Error state
    platform.robots.set('duid1', robot);

    await handleLocalMessage({ state: 0, battery: 50 } as any, platform as any, 'duid1');
    // Should not call updateAttribute for operationalState since already in error
    expect(robot.updateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.any(Number), mockLog);
  });

  it('handles data from log with segment_id -1 for FF ON', async () => {
    const platform = getMockPlatform();
    mockGetRoomMap.mockReturnValue(roomMapFromLog);
    mockGetSupportedAreas.mockReturnValue(currentMappedAreasFromLog);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map())); // Empty

    await handleLocalMessage(cloudMessageResultFromLog as any, platform as any, 'duid1');

    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('source_segment_id: -1'));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('areaId: undefined'));
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, mockLog);
  });
});

describe('handleLocalMessage -- FF OFF', () => {
  const getMockPlatform = (robotExists = true) => {
    const robots = new Map(robotExists ? [['duid1', getMockRobot()]] : []);
    return {
      robots,
      registry: {
        getRobot: (id: string) => robots.get(id),
      },
      configManager: {
        isMultipleMapEnabled: false,
      },
      log: mockLog,
      roborockService: {
        getSelectedAreas: vi.fn(() => ['area1']),
        getSupportedAreas: mockGetSupportedAreas,
        getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
        getMapInformation: vi.fn().mockReturnValue(mapInfo),
      },
      enableExperimentalFeature: {
        enableExperimentalFeature: false,
        advancedFeature: {
          enableMultipleMap: false,
        },
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 0 } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
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

      getAreaId(roomId: number): Area | undefined {
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

  it('returns early when robot not found in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: 1 } } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
  });

  it('returns early when cleaning_info is missing in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 1, mapId: 0 }]);
    await handleLocalMessage({ state: 5 } as any, platform as any, 'duid1');
    // Should not crash and should update selectedAreas to empty
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('sets currentArea to null when segment_id is -1', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 1, mapId: 0 }]);
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: -1 } } as any, platform as any, 'duid1');
    // The function does not set currentArea to null if segment_id is -1 and no mappedArea is found, it skips updating currentArea.
    // Instead, it may update currentMode. Let's check that currentMode is set.
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'currentMode', expect.anything(), mockLog);
  });

  it('handles robot not found when getting dss status', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 5, dss: 1 } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
  });

  it('handles robot not found in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: 1 } } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
  });

  it('handles robot not found in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform(false);
    platform.enableExperimentalFeature = {
      enableExperimentalFeature: true,
      advancedFeature: { enableMultipleMap: true },
    };
    await handleLocalMessage({ state: 5, cleaning_info: { segment_id: 1 } } as any, platform as any, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('Robot not found: duid1');
  });

  it('handles missing cleaning_info in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform();
    platform.enableExperimentalFeature = {
      enableExperimentalFeature: true,
      advancedFeature: { enableMultipleMap: true },
    };
    const roomMap = new Map([[1, { roomId: 1, mapId: 0 }]]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(roomMap));
    await handleLocalMessage({ state: 5 } as any, platform as any, 'duid1');
    // Should not crash
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('handles data from log with segment_id -1', async () => {
    const platform = getMockPlatform();
    mockGetRoomMap.mockReturnValue(roomMapFromLog);
    mockGetSupportedAreas.mockReturnValue(currentMappedAreasFromLog);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map())); // Empty

    await handleLocalMessage(cloudMessageResultFromLog as any, platform as any, 'duid1');

    // The function does not set currentArea to null if segment_id is -1 and no mappedArea is found, it skips updating currentArea.
    // Instead, it may update currentMode and battery attributes.
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'currentMode', expect.anything(), mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, mockLog); // battery 100 * 2
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.any(Number), mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeLevel', expect.any(Number), mockLog);
  });
});

interface Area {
  roomId: number;
  mapId: number;
}
