import { debugStringify } from 'matterbridge/logger';
import { RoomMap } from './model/RoomMap.js';
import { RoborockMatterbridgePlatform } from './platform.js';
import { Device } from './roborockCommunication/index.js';
import { CloudMessageResult } from './roborockCommunication/Zmodel/messageResult.js';

export function getVacuumProperty(device: Device, property: string): number | undefined {
  if (device) {
    const schemas = device.schema;
    const schema = schemas.find((sch) => sch.code == property);

    if (schema && device.deviceStatus && device.deviceStatus[schema.id] != undefined) {
      return Number(device.deviceStatus[schema.id]);
    }

    if (device.deviceStatus && device.deviceStatus[property] != undefined) {
      return Number(device.deviceStatus[property]);
    }
  }

  return undefined;
}

export function isSupportedDevice(model: string): boolean {
  return model.startsWith('roborock.vacuum.');
}

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

export async function getRoomMap(duid: string, platform: RoborockMatterbridgePlatform): Promise<RoomMap | undefined> {
  const robot = platform.robots.get(duid);
  if (robot === undefined) {
    platform.log.error(`Error6: Robot with DUID ${duid} not found`);
    return undefined;
  }

  if (platform.roborockService === undefined) return undefined;

  const rooms = robot.device.rooms ?? [];
  // if (platform.robot?.device === undefined || platform.roborockService === undefined) return undefined;
  if (robot.roomInfo === undefined) {
    const roomData = await platform.roborockService.getRoomMappings(robot.device.duid);
    if (roomData !== undefined && roomData.length > 0) {
      robot.roomInfo = new RoomMap(roomData ?? [], rooms);
      return robot.roomInfo;
    }
  }

  if (robot.roomInfo === undefined) {
    const mapInfo = await platform.roborockService.getMapInformation(robot.device.duid);
    if (mapInfo && mapInfo.maps && mapInfo.maps.length > 0) {
      platform.log.error(`getRoomMap - mapInfo: ${debugStringify(mapInfo.maps)}`);

      const roomDataMap = mapInfo.maps[0].rooms.map((r) => [r.id, parseInt(r.iot_name_id), r.tag] as [number, number, number]);
      robot.roomInfo = new RoomMap(roomDataMap, rooms);
    }
  }

  return robot.roomInfo;
}

export async function getRoomMapFromDevice(device: Device, platform: RoborockMatterbridgePlatform): Promise<RoomMap> {
  const rooms = device?.rooms ?? [];

  platform.log.notice('-------------------------------------------0--------------------------------------------------------');
  platform.log.notice(`getRoomMapFromDevice: ${debugStringify(rooms)}`);

  if (device && platform.roborockService) {
    const roomData = await platform.roborockService.getRoomMappings(device.duid);
    if (roomData !== undefined && roomData.length > 0) {
      platform.log.notice(`getRoomMapFromDevice - roomData: ${debugStringify(roomData ?? [])}`);

      const roomMap = new RoomMap(roomData ?? [], rooms);

      platform.log.notice(`getRoomMapFromDevice - roomMap: ${debugStringify(roomMap)}`);
      platform.log.notice('-------------------------------------------1--------------------------------------------------------');
      return roomMap;
    }

    const mapInfo = await platform.roborockService.getMapInformation(device.duid);
    platform.log.notice(`getRoomMapFromDevice - mapInfo: ${mapInfo ? debugStringify(mapInfo) : 'undefined'}`);

    if (mapInfo && mapInfo.maps && mapInfo.maps.length > 0) {
      const roomDataMap = mapInfo.maps[0].rooms.map((r) => [r.id, parseInt(r.iot_name_id), r.tag] as [number, number, number]);

      const roomMap = new RoomMap(roomDataMap, rooms);

      platform.log.notice(`getRoomMapFromDevice - roomMap: ${debugStringify(roomMap)}`);
      platform.log.notice('-------------------------------------------2--------------------------------------------------------');
      return roomMap;
    }
  }

  return new RoomMap([], rooms);
}
