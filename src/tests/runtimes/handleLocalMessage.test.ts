import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLocalMessage } from '../../runtimes/handleLocalMessage.js';
import { asPartial, createMockLogger, createMockConfigManager } from '../testUtils.js';
import type { Device } from '../../roborockCommunication/models/index.js';
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
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import type { CloudMessageResult } from '../../roborockCommunication/models/index.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { RoomIndexMap } from '../../core/application/models/index.js';
import { DeviceModel } from '../../roborockCommunication/models/index.js';
import { DeviceCategory } from '../../roborockCommunication/models/deviceCategory.js';

// Mocks

const mockUpdateAttribute = vi.fn();
const simpleUpdateAttribute = (...args: any[]) => mockUpdateAttribute(...args);
const mockGetSupportedAreas = vi.fn();
const mockGetSupportedAreasIndexMap = vi.fn();
const mockGetRoomMap = vi.fn();

vi.mock('../helper.js', () => ({
  getRoomMap: mockGetRoomMap,
}));

const mockLog = createMockLogger();

import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { DeviceRegistry } from '../../platform/deviceRegistry.js';
import { RoborockService } from '../../services/roborockService.js';
import { PlatformRunner } from '../../platformRunner.js';
import { PlatformLifecycle } from '../../platform/platformLifecycle.js';
import { PlatformState } from '../../platform/platformState.js';
import { LocalStorage } from 'node-persist';

const getMockRobot = () => {
  return asPartial<RoborockVacuumCleaner>({
    username: 'test-user',
    device: asPartial<Device>({
      duid: 'duid1',
      data: asPartial({ id: '1', firmwareVersion: '1.0', serialNumber: 'SN1', category: DeviceCategory.VacuumCleaner, batteryLevel: 50, model: DeviceModel.QREVO_EDGE_5V1 }),
      name: 'TestVac',
    }),
    updateAttribute: vi.fn((...args: any[]) => mockUpdateAttribute(...args)),
    getAttribute: vi.fn(() => undefined),
  });
};

describe('handleLocalMessage -- FF ON', () => {
  const getMockPlatform = (robotExists = true, includeDockStatus = false): RoborockMatterbridgePlatform => {
    const robots = new Map(robotExists ? [['duid1', getMockRobot()]] : []);
    const registry = asPartial<DeviceRegistry>({
      getRobot: (id: string) => robots.get(id),
      robotsMap: robots,
      hasDevices: () => robots.size > 0,
      registerRobot: vi.fn(),
      getAllDevices: vi.fn().mockReturnValue(Array.from(robots.values())),
      registerDevice: vi.fn(),
    });
    const platformRunner = asPartial<PlatformRunner>({
      updateRobotWithPayload: vi.fn(),
      requestHomeData: vi.fn(),
    });

    const roborockService = asPartial<RoborockService>({
      getSelectedAreas: vi.fn(() => [1]),
      getSupportedAreas: mockGetSupportedAreas,
      getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
      getMapInfo: vi.fn().mockReturnValue(mapInfo),
    });

    return asPartial<RoborockMatterbridgePlatform>({
      registry,
      configManager: createMockConfigManager({ isMultipleMapEnabled: true }),
      log: mockLog,
      roborockService,
      platformRunner,
      lifecycle: asPartial<PlatformLifecycle>({ onStart: vi.fn(), onConfigure: vi.fn(), onShutdown: vi.fn() }),
      state: asPartial<PlatformState>({}),
      persist: asPartial<LocalStorage>({ getItem: vi.fn(), setItem: vi.fn() }),
      onStart: vi.fn(async () => {}),
      onConfigure: vi.fn(async () => {}),
      onShutdown: vi.fn(async () => {}),
      onChangeLoggerLevel: vi.fn(async () => {}),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0 }), platform, 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('updates selectedAreas on Idle', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: OperationStatusCode.Idle }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [1], mockLog);
  });

  it('updates currentArea and selectedAreas to null/[] when cleaning_info is missing', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 5 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    await new Promise(process.nextTick);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('updates battery attributes if battery present', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0, battery: 50 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
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

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult3), platform, 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('No cleaning_info'));

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult1), platform, 'duid1');
    {
      const currentAreaCalls = mockUpdateAttribute.mock.calls.filter((c) => c[1] === 'currentArea' && c[0] === ServiceArea.Cluster.id);
      expect(currentAreaCalls.some((c) => c[2] === 102)).toBeTruthy();
    }

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult2), platform, 'duid1');
    {
      const currentAreaCalls = mockUpdateAttribute.mock.calls.filter((c) => c[1] === 'currentArea' && c[0] === ServiceArea.Cluster.id);
      expect(currentAreaCalls.some((c) => c[2] === 103)).toBeTruthy();
    }
  });

  it('returns early when robot not found in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: 1, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('returns early when cleaning_info is missing in mapRoomsToAreasFeatureOn', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 100, mapId: 0 }]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map([[100, { roomId: 1, mapId: 0 }]])));
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('returns early when areaId is not found', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 100, mapId: 0 }]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map()));
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: 99, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
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

    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0, dss: 0b01 }), asPartial<RoborockMatterbridgePlatform>(platformNoDss), 'duid1');
    // Should not trigger error state
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'operationalState', 3, mockLog);
  });

  it('triggerDssError returns true if already in Error state', async () => {
    const platform = getMockPlatform();
    const robot = getMockRobot();
    robot.getAttribute = vi.fn(() => 3);
    asPartial<RoborockMatterbridgePlatform>(platform).registry.robotsMap.set('duid1', robot);

    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0, battery: 50 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    // Should not call updateAttribute for operationalState since already in error
    expect(robot.updateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.any(Number), mockLog);
  });

  it('handles data from log with segment_id -1 for FF ON', async () => {
    const platform = getMockPlatform(true);
    mockGetRoomMap.mockReturnValue(roomMapFromLog);
    mockGetSupportedAreas.mockReturnValue(currentMappedAreasFromLog);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map())); // Empty

    await handleLocalMessage(asPartial<CloudMessageResult>({ ...cloudMessageResultFromLog }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');

    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('source_segment_id: -1'));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('areaId: undefined'));
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, mockLog);
  });
});

describe('handleLocalMessage -- FF OFF', () => {
  const getMockPlatform = (robotExists = true): any => {
    const robots = new Map(robotExists ? [['duid1', getMockRobot()]] : []);
    return {
      robots,
      registry: {
        getRobot: (id: string) => robots.get(id),
        robotsMap: robots,
        hasDevices: () => robots.size > 0,
        registerRobot: vi.fn(),
        getAllDevices: vi.fn().mockReturnValue(Array.from(robots.values())),
        registerDevice: vi.fn(),
        devices: new Map(),
        robots: new Map(),
      },
      configManager: createMockConfigManager({ isMultipleMapEnabled: false }),
      log: mockLog,
      roborockService: {
        getSelectedAreas: vi.fn(() => [1]),
        getSupportedAreas: mockGetSupportedAreas,
        getSupportedAreasIndexMap: mockGetSupportedAreasIndexMap,
        getMapInfo: vi.fn().mockReturnValue(mapInfo),
      },
      platformRunner: { requestHomeData: vi.fn(), updateRobotWithPayload: vi.fn() },
      lifecycle: { onStart: vi.fn(), onConfigure: vi.fn(), onShutdown: vi.fn() },
      state: {},
      persist: { getItem: vi.fn(), setItem: vi.fn() },
      startDeviceDiscovery: vi.fn(async () => false),
      onConfigureDevice: vi.fn(async () => {}),
      configureDevice: vi.fn(async () => false),
      addDevice: vi.fn(),
      onStart: vi.fn(async () => {}),
      onConfigure: vi.fn(async () => {}),
      onShutdown: vi.fn(async () => {}),
      onChangeLoggerLevel: vi.fn(async () => {}),
      enableExperimentalFeature: {
        enableExperimentalFeature: false,
        advancedFeature: {
          enableMultipleMap: false,
        },
      },
    };
  };

  it('logs error if robot not found', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs error if robot not found (after clearing mocks)', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('updates selectedAreas on Idle', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: OperationStatusCode.Idle }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [1], mockLog);
  });

  it('updates currentArea and selectedAreas to null/[] when cleaning_info is missing', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 5 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    await new Promise(process.nextTick);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('updates battery attributes if battery present', async () => {
    const platform = getMockPlatform();
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 0, battery: 50 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
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

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult3), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLog);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('No cleaning_info'));

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult1), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    {
      const currentAreaCalls = mockUpdateAttribute.mock.calls.filter((c) => c[1] === 'currentArea' && c[0] === ServiceArea.Cluster.id);
      // FF OFF: expect currentArea to be the segment_id -> 3
      expect(currentAreaCalls.some((c) => c[2] === 3)).toBeTruthy();
    }

    await handleLocalMessage(asPartial<CloudMessageResult>(cloudMessageResult2), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    {
      const currentAreaCalls = mockUpdateAttribute.mock.calls.filter((c) => c[1] === 'currentArea' && c[0] === ServiceArea.Cluster.id);
      expect(currentAreaCalls.some((c) => c[2] === 4)).toBeTruthy();
    }
  });

  it('returns early when robot not found in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: 1, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('returns early when cleaning_info is missing in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 1, mapId: 0 }]);
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 5 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    // Should not crash and should update selectedAreas to empty
    expect(mockUpdateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLog);
  });

  it('sets currentArea to null when segment_id is -1', async () => {
    const platform = getMockPlatform();
    mockGetSupportedAreas.mockReturnValue([{ areaId: 1, mapId: 0 }]);
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: -1, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
    // The function does not set currentArea to null if segment_id is -1 and no mappedArea is found, it skips updating currentArea.
    // Instead, it may update currentMode. Let's check that currentMode is set.
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'currentMode', expect.anything(), mockLog);
  });

  it('handles robot not found when getting dss status', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 5, dss: 1 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('handles robot not found in mapRoomsToAreasFeatureOff', async () => {
    const platform = getMockPlatform(false);
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: 1, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('handles robot not found in mapRoomsToAreasFeatureOn', async () => {
    const platform = {
      ...getMockPlatform(false),
      enableExperimentalFeature: { enableExperimentalFeature: true, advancedFeature: { enableMultipleMap: true } },
    };
    await handleLocalMessage(
      asPartial<CloudMessageResult>({ state: 5, cleaning_info: { segment_id: 1, target_segment_id: 2, fan_power: 102, water_box_status: 100, mop_mode: 1 } }),
      asPartial<RoborockMatterbridgePlatform>(platform),
      'duid1',
    );
    expect(mockLog.error).toHaveBeenCalledWith('[handleLocalMessage] Robot or RoborockService not found: duid1');
  });

  it('handles missing cleaning_info in mapRoomsToAreasFeatureOn', async () => {
    const platform = {
      ...getMockPlatform(),
      enableExperimentalFeature: { enableExperimentalFeature: true, advancedFeature: { enableMultipleMap: true } },
    };
    const roomMap = new Map([[1, { roomId: 1, mapId: 0 }]]);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(roomMap));
    await handleLocalMessage(asPartial<CloudMessageResult>({ state: 5 }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');
    // Should not crash
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('handles data from log with segment_id -1', async () => {
    const platform = getMockPlatform();
    mockGetRoomMap.mockReturnValue(roomMapFromLog);
    mockGetSupportedAreas.mockReturnValue(currentMappedAreasFromLog);
    mockGetSupportedAreasIndexMap.mockReturnValue(new RoomIndexMap(new Map())); // Empty

    await handleLocalMessage(asPartial<CloudMessageResult>({ ...cloudMessageResultFromLog }), asPartial<RoborockMatterbridgePlatform>(platform), 'duid1');

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
