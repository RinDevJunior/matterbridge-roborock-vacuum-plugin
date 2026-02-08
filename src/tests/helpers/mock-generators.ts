import type { ServiceArea } from 'matterbridge/matter/clusters';
import { DeviceBuilder } from './device-builder.js';
import { CloudMessageResult, DeviceModel, Home, Scene, UserData } from '../../roborockCommunication/models/index.js';
import { asPartial } from '../testUtils.js';
import { RoomEntity } from '../../core/domain/entities/Room.js';

/**
 * Generates a mock UserData object for testing.
 *
 * @param overrides - Optional property overrides
 * @returns UserData instance
 *
 * @example
 * ```typescript
 * const userData = generateMockUserData({ region: 'eu' });
 * ```
 */
export function generateMockUserData(overrides?: Partial<UserData>): UserData {
  const defaultData: UserData = {
    username: 'test-user',
    uid: Math.floor(Math.random() * 1000000),
    tokentype: 'mock',
    token: `mock-token-${Math.random().toString(36).substring(7)}`,
    rruid: `rr-mock-${Math.random().toString(36).substring(7)}`,
    region: 'us',
    countrycode: '1',
    country: 'US',
    nickname: 'Mock User',
    rriot: {
      u: 'mock-u',
      s: 'mock-s',
      h: 'mock-h',
      k: 'mock-k',
      r: {
        r: 'US',
        a: 'https://api-us.roborock.com',
        m: 'ssl://mqtt-us.roborock.com:8883',
        l: 'https://wood-us.roborock.com',
      },
    },
  };

  return { ...defaultData, ...overrides };
}

/**
 * Generates a mock Home object with devices and rooms.
 *
 * @param deviceCount - Number of devices to include (default: 1)
 * @param roomCount - Number of rooms to include (default: 4)
 * @returns Home instance
 *
 * @example
 * ```typescript
 * const home = generateMockHome(2, 6); // 2 devices, 6 rooms
 * ```
 */
export function generateMockHome(deviceCount = 1, roomCount = 4): Home {
  const rooms = Array.from({ length: roomCount }, (_, i) => new RoomEntity(10000 + i, `Room ${i + 1}`));

  const homeData: Home = {
    id: 123456,
    name: 'Mock Home',
    products: [
      {
        id: 'mock-product-1',
        name: 'Mock Vacuum Product',
        model: DeviceModel.Q5,
        category: 'robot.vacuum.cleaner',
        schema: [],
      },
    ],
    devices: [],
    receivedDevices: [],
    rooms,
  };

  const devices = Array.from({ length: deviceCount }, (_, i) =>
    new DeviceBuilder()
      .withDuid(`mock-device-${i}`)
      .withName(`Mock Vacuum ${i + 1}`)
      .withModel(DeviceModel.Q5)
      .withHomeData(homeData)
      .build(),
  );

  homeData.devices = devices;

  return homeData;
}

/**
 * Generates a mock CloudMessageResult for device status.
 *
 * @param overrides - Optional property overrides
 * @returns CloudMessageResult instance
 *
 * @example
 * ```typescript
 * const status = generateMockDeviceStatus({ battery: 75, state: 5 });
 * ```
 */
export function generateMockDeviceStatus(overrides?: Partial<CloudMessageResult>): CloudMessageResult {
  const defaultStatus: CloudMessageResult = {
    msg_ver: 2,
    msg_seq: Math.floor(Math.random() * 10000),
    state: 8, // Charging
    battery: 100,
    clean_time: 0,
    clean_area: 0,
    error_code: 0,
    map_present: 1,
    in_cleaning: 0,
    in_returning: 0,
    in_fresh_state: 1,
    lab_status: 1,
    water_box_status: 0,
    fan_power: 102,
    dnd_enabled: 0,
    map_status: 3,
    is_locating: 0,
    lock_status: 0,
    water_box_mode: 200,
    distance_off: 0,
    water_box_carriage_status: 0,
    mop_forbidden_enable: 0,
    adbumper_status: [0, 0, 0],
    dock_type: 0,
    dust_collection_status: 0,
    auto_dust_collection: 1,
    debug_mode: 0,
    switch_map_mode: 0,
    dock_error_status: 0,
    charge_status: 1,
  };

  return { ...defaultStatus, ...overrides };
}

/**
 * Generates mock cleaning areas (rooms) for testing.
 *
 * @param count - Number of areas to generate (default: 4)
 * @param mapId - Map ID for the areas (default: 0)
 * @returns Array of ServiceArea.Area instances
 *
 * @example
 * ```typescript
 * const areas = generateMockAreas(6, 1); // 6 areas on map 1
 * ```
 */
export function generateMockAreas(count = 4, mapId = 0): ServiceArea.Area[] {
  const roomNames = ['Kitchen', 'Living Room', 'Bedroom', 'Study', 'Bathroom', 'Hallway', 'Dining Room', 'Office'];

  return Array.from({ length: count }, (_, i) => ({
    areaId: 100 + i + mapId * 100,
    mapId,
    areaInfo: {
      locationInfo: {
        locationName: roomNames[i % roomNames.length],
        floorNumber: mapId,
        areaType: null,
      },
      landmarkInfo: null,
    },
  }));
}

/**
 * Generates mock scenes/routines for testing.
 *
 * @param count - Number of scenes to generate (default: 2)
 * @returns Array of Scene instances
 *
 * @example
 * ```typescript
 * const scenes = generateMockScenes(3);
 * ```
 */
export function generateMockScenes(count = 2): Scene[] {
  const sceneNames = ['Quick Clean', 'Deep Clean', 'Night Mode', 'Morning Routine', 'Weekend Clean'];

  return Array.from({ length: count }, (_, i) => {
    const scene = new Scene();
    scene.id = 5000 + i;
    scene.name = sceneNames[i % sceneNames.length];
    scene.enabled = true;
    scene.type = 'robot.vacuum.cleaner';
    return scene;
  });
}
