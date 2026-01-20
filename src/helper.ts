import { debugStringify } from 'matterbridge/logger';
import { RoomMap } from './model/RoomMap.js';
import { RoborockMatterbridgePlatform } from './module.js';
import { Device } from './roborockCommunication/index.js';
import { CloudMessageResult } from './roborockCommunication/Zmodel/messageResult.js';
import { MapRoom } from './roborockCommunication/Zmodel/mapInfo.js';

/** Get vacuum property by schema code or property name. */
export function getVacuumProperty(device: Device, property: string): number | undefined {
  if (!device) {
    return undefined;
  }

  const schemas = device.schema;
  const schema = schemas.find((sch) => sch.code === property);

  if (schema && device.deviceStatus && device.deviceStatus[schema.id] !== undefined) {
    return Number(device.deviceStatus[schema.id]);
  }

  if (device.deviceStatus && device.deviceStatus[property] !== undefined) {
    return Number(device.deviceStatus[property]);
  }

  return undefined;
}

/** Check if model is supported (roborock.vacuum.*). */
export function isSupportedDevice(model: string): boolean {
  return model.startsWith('roborock.vacuum.');
}

/** Check if result is a status update message. */
export function isStatusUpdate(result: unknown): boolean {
  return (
    Array.isArray(result) &&
    result.length > 0 &&
    typeof result[0] === 'object' &&
    result[0] !== null &&
    'msg_ver' in result[0] &&
    (result[0] as CloudMessageResult).msg_ver !== undefined &&
    (result[0] as CloudMessageResult).msg_ver !== null
  );
}

/** Convert raw room data to MapRoom array. */
function createRoomDataMap(roomData: number[][]): MapRoom[] {
  return roomData.map((r) => ({
    id: r[0],
    iot_name_id: String(r[1]),
    globalId: r[1],
    tag: r[2],
    mapId: 0,
    displayName: undefined,
  }));
}

/** Get room map for device (uses cache or fetches from API). */
export async function getRoomMap(duid: string, platform: RoborockMatterbridgePlatform): Promise<RoomMap | undefined> {
  const robot = platform.robots.get(duid);
  if (!robot) {
    platform.log.error(`Robot with DUID ${duid} not found`);
    return undefined;
  }

  if (!platform.roborockService) {
    return undefined;
  }

  const enableMultipleMap = (platform.enableExperimentalFeature?.enableExperimentalFeature && platform.enableExperimentalFeature?.advancedFeature.enableMultipleMap) ?? false;
  const rooms = robot.device.rooms ?? [];

  // Return cached room info if available
  if (robot.roomInfo) {
    return robot.roomInfo;
  }

  // Try to get map information first
  const mapInfo = await platform.roborockService.getMapInformation(robot.device.duid);
  if (mapInfo && mapInfo.allRooms && mapInfo.allRooms.length > 0) {
    platform.log.info(`getRoomMap - mapInfo: ${debugStringify(mapInfo.allRooms)}`);
    robot.roomInfo = new RoomMap(mapInfo.allRooms, rooms, mapInfo.maps, enableMultipleMap);
    return robot.roomInfo;
  }

  // Fall back to room mappings
  const roomData = await platform.roborockService.getRoomMappings(robot.device.duid);
  if (roomData && roomData.length > 0) {
    const roomDataMap = createRoomDataMap(roomData);
    robot.roomInfo = new RoomMap(roomDataMap, rooms, [], enableMultipleMap);
    return robot.roomInfo;
  }

  return undefined;
}

/**
 * Get room map directly from device without caching.
 * Tries to get room info from map information first, then falls back to room mappings.
 * @param device - The vacuum device
 * @param platform - Platform instance for accessing services and configuration
 * @returns RoomMap instance (may be empty if no room data available)
 */
export async function getRoomMapFromDevice(device: Device, platform: RoborockMatterbridgePlatform): Promise<RoomMap> {
  const rooms = device?.rooms ?? [];
  const enableMultipleMap = (platform.enableExperimentalFeature?.enableExperimentalFeature && platform.enableExperimentalFeature?.advancedFeature.enableMultipleMap) ?? false;

  if (!device || !platform.roborockService) {
    return new RoomMap([], rooms, [], enableMultipleMap);
  }

  // Try to get map information first
  const mapInfo = await platform.roborockService.getMapInformation(device.duid);
  platform.log.debug(
    `getRoomMapFromDevice
    - mapInfo: ${mapInfo ? debugStringify(mapInfo) : 'undefined'}
    - rooms: ${debugStringify(rooms)}`,
  );

  if (mapInfo && mapInfo.allRooms && mapInfo.allRooms.length > 0) {
    return new RoomMap(mapInfo.allRooms, rooms, mapInfo.maps, enableMultipleMap);
  }

  // Fall back to room mappings
  const roomData = await platform.roborockService.getRoomMappings(device.duid);
  if (roomData && roomData.length > 0) {
    platform.log.notice(`getRoomMapFromDevice - roomData: ${debugStringify(roomData)}`);
    const roomDataMap = createRoomDataMap(roomData);
    return new RoomMap(roomDataMap, rooms, [], enableMultipleMap);
  }

  return new RoomMap([], rooms, [], enableMultipleMap);
}
