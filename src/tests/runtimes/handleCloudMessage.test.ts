import { describe, it, beforeEach, expect, vi } from 'vitest';
import { AdditionalPropCode, Protocol } from '../../roborockCommunication/index.js';
import { handleCloudMessage } from '../../runtimes/handleCloudMessage.js';
import { mapInfo, roomData, roomIndexMap, supportedAreas, supportedMaps } from '../testData/mockData.js';

// Mocks for dependencies
const mockUpdateAttribute = vi.fn().mockImplementation((clusterId: number, attributeName: string, value: any, log: any) => {
  log.debug(`Mock updateAttribute called with clusterId: ${clusterId}, attributeName: ${attributeName}, value: ${value}`);
});
const mockSetSupportedAreas = vi.fn();
const mockSetSelectedAreas = vi.fn();
const mockSetSupportedAreaIndexMap = vi.fn();
const mockGetCleanModeData = vi.fn();
const mockUpdateFromMQTTMessage = vi.fn();
const mockGetRoomMapFromDevice = vi.fn();
const mockGetSupportedAreas = vi.fn();

vi.mock('../helper.js', () => ({
  getRoomMapFromDevice: (...args: any[]) => mockGetRoomMapFromDevice(...args),
  isStatusUpdate: (result: any) => result === 'status',
}));
vi.mock('../initialData/getSupportedAreas.js', () => ({
  getSupportedAreas: (...args: any[]) => mockGetSupportedAreas(...args),
}));

const duid = 'test-duid';
const robot = {
  updateAttribute: mockUpdateAttribute,
  device: {
    data: { model: 'test-model' },
    rooms: [
      { id: 11100845, name: 'Kitchen' },
      { id: 11100849, name: 'Study' },
      { id: 11100842, name: 'Living room' },
      { id: 11100847, name: 'Bedroom' },
      { id: 12469150, name: 'Dining room' },
      { id: 12461114, name: 'Guest bedroom' },
      { id: 12461109, name: 'Master bedroom' },
      { id: 12461111, name: 'Balcony' },
      { id: 11100842, name: 'Living room' },
    ],
  },
  dockStationStatus: {},
};
const platform = {
  robots: new Map([[duid, robot]]),
  log: {
    error: vi.fn(),
    debug: vi.fn(),
    notice: vi.fn(),
    fatal: vi.fn().mockImplementation((_message: string, ..._arg: unknown[]) => {
      /* intentionally empty for test */
    }),
  },
  roborockService: {
    getCleanModeData: mockGetCleanModeData,
    setSupportedAreas: mockSetSupportedAreas,
    setSelectedAreas: mockSetSelectedAreas,
    setSupportedAreaIndexMap: mockSetSupportedAreaIndexMap,
    getMapInformation: vi.fn().mockResolvedValue(mapInfo),
    getRoomMappings: vi.fn().mockResolvedValue(roomData),
  },
  enableExperimentalFeature: {
    enableExperimentalFeature: true,
    advancedFeature: {
      enableMultipleMap: true,
    },
  },
};
const runner = { updateFromMQTTMessage: mockUpdateFromMQTTMessage };

describe('handleCloudMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles status_update', async () => {
    const data = { duid: 'test-duid', dps: { 121: 6, 128: 3, 139: 5 } };
    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('handles rpc_response with status', async () => {
    const data = {
      duid: 'test-duid',
      dps: {
        102: {
          id: 19937,
          result: [
            {
              msg_ver: 2,
              msg_seq: 2609,
              state: 5,
              battery: 99,
              clean_time: 12,
              clean_area: 0,
              error_code: 0,
              map_present: 1,
              in_cleaning: 1,
              in_returning: 0,
              in_fresh_state: 0,
              lab_status: 3,
              water_box_status: 1,
              fan_power: 101,
              dnd_enabled: 0,
              map_status: 3,
              is_locating: 0,
              lock_status: 0,
              water_box_mode: 202,
              distance_off: 60,
              water_box_carriage_status: 0,
              mop_forbidden_enable: 0,
              adbumper_status: [0, 0, 0],
              dock_type: 5,
              dust_collection_status: 0,
              auto_dust_collection: 1,
              debug_mode: 0,
              switch_map_mode: 0,
              dock_error_status: 0,
              charge_status: 1,
            },
          ],
        },
      },
    };

    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(mockUpdateFromMQTTMessage).toHaveBeenCalled();
  });

  it('handles additional_props with map_change', async () => {
    mockGetRoomMapFromDevice.mockResolvedValueOnce({});
    mockGetSupportedAreas.mockReturnValueOnce({
      supportedAreas,
      supportedMaps,
      roomIndexMap,
    });
    const data = { dps: { [Protocol.additional_props]: AdditionalPropCode.map_change } };
    await handleCloudMessage(data as any, platform as any, runner as any, duid);

    await new Promise(process.nextTick);
    expect(mockSetSupportedAreas).toHaveBeenCalled();
    expect(mockSetSelectedAreas).toHaveBeenCalled();
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('logs error if robot not found', async () => {
    const fakePlatform = { ...platform, robots: new Map() };
    const data = { dps: { [Protocol.status_update]: 1 } };
    await handleCloudMessage(data as any, fakePlatform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(platform.log.error).toHaveBeenCalled();
  });

  it('handles unknown message type', async () => {
    const data = { dps: { 999: 42 } };
    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(platform.log.notice).toHaveBeenCalled();
  });

  it('handles map_change', async () => {
    const data = { dps: { 128: 4 } };
    mockGetRoomMapFromDevice.mockReturnValue({
      rooms: [
        { id: 1, globalId: 11100845, displayName: 'Kitchen', alternativeId: '114', mapId: 0 },
        { id: 2, globalId: 11100849, displayName: 'Study', alternativeId: '29', mapId: 0 },
        { id: 3, globalId: 11100842, displayName: 'Living room', alternativeId: '36', mapId: 0 },
        { id: 4, globalId: 11100847, displayName: 'Bedroom', alternativeId: '41', mapId: 0 },
      ],
      mapInfo: [
        {
          id: 0,
          name: 'First Map',
          rooms: [
            { id: 1, globalId: 11100845, iot_name_id: '11100845', tag: 14, displayName: 'Kitchen', mapId: 0 },
            { id: 2, globalId: 11100849, iot_name_id: '11100849', tag: 9, displayName: 'Study', mapId: 0 },
            { id: 3, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 0 },
            { id: 4, globalId: 11100847, iot_name_id: '11100847', tag: 1, displayName: 'Bedroom', mapId: 0 },
          ],
        },
        {
          id: 1,
          name: 'Second Map',
          rooms: [
            { id: 1, globalId: 12469150, iot_name_id: '12469150', tag: 13, displayName: 'Dining room', mapId: 1 },
            { id: 2, globalId: 12461114, iot_name_id: '12461114', tag: 3, displayName: 'Guest bedroom', mapId: 1 },
            { id: 3, globalId: 12461109, iot_name_id: '12461109', tag: 2, displayName: 'Master bedroom', mapId: 1 },
            { id: 4, globalId: 12461111, iot_name_id: '12461111', tag: 7, displayName: 'Balcony', mapId: 1 },
            { id: 5, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 1 },
          ],
        },
      ],
    });

    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(platform.log.notice).toHaveBeenCalled();
  });

  it('handles rpc_response with status result', async () => {
    const data = {
      dps: {
        [Protocol.rpc_response]: {
          result: 'status',
        },
      },
    };
    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(platform.log.debug).toHaveBeenCalled();
  });

  it('handles suction_power message', async () => {
    const data = {
      dps: {
        [Protocol.suction_power]: 100,
      },
    };
    mockGetCleanModeData.mockResolvedValue({ suctionPower: 100, waterFlow: 50, distance_off: 0, mopRoute: 0 });
    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(mockGetCleanModeData).toHaveBeenCalledWith(duid);
  });

  it('handles water_box_mode message', async () => {
    const data = {
      dps: {
        [Protocol.water_box_mode]: 200,
      },
    };
    mockGetCleanModeData.mockResolvedValue({ suctionPower: 100, waterFlow: 200, distance_off: 0, mopRoute: 0 });
    await handleCloudMessage(data as any, platform as any, runner as any, duid);
    await new Promise(process.nextTick);
    expect(mockGetCleanModeData).toHaveBeenCalledWith(duid);
  });
});
