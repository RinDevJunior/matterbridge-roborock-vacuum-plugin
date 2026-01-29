import { RoomMapping } from './RoomMapping.js';
import { RoomDto } from '../../../roborockCommunication/models/home/index.js';
import { HomeModelMapper } from '../../../roborockCommunication/models/home/mappers.js';
import { debugStringify } from 'matterbridge/logger';
import { RoborockMatterbridgePlatform } from '../../../module.js';
import { Device } from '../../../roborockCommunication/models/device.js';

export interface MapReference {
  id: number;
  name: string | undefined;
}

export class RoomMap {
  constructor(private readonly roomMappings: RoomMapping[]) {}

  public get hasRooms(): boolean {
    return this.roomMappings.length > 0;
  }

  public get rooms(): RoomMapping[] {
    return this.roomMappings;
  }

  public getRooms(map_info: MapReference[], enableMultipleMap = false): RoomMapping[] {
    const mapid = map_info[0]?.id ?? 0;
    return enableMultipleMap ? this.roomMappings : this.roomMappings.filter((room) => room.iot_map_id === undefined || room.iot_map_id === mapid);
  }

  /**
   * Get room map for device (with caching).
   */
  public static async fromDevice(duid: string, platform: RoborockMatterbridgePlatform): Promise<RoomMap> {
    const robot = platform.registry.getRobot(duid);
    if (!robot) {
      platform.log.error(`Robot with DUID ${duid} not found`);
      return new RoomMap([]);
    }

    if (!platform.roborockService) {
      return new RoomMap([]);
    }

    const rooms: RoomDto[] = robot.device.rooms ?? [];

    // Return cached room info if available
    if (robot.roomInfo) {
      return robot.roomInfo;
    }

    // Try to get map information first
    const mapInfo = await platform.roborockService.getMapInfo(robot.device.duid);
    robot.mapInfos = mapInfo.maps;
    if (mapInfo.hasRooms) {
      platform.log.info(`getRoomMap - mapInfo: ${debugStringify(mapInfo.allRooms)}`);
      const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
      robot.roomInfo = new RoomMap(roomMappings);

      return robot.roomInfo;
    }

    // Fall back to room maps
    const roomData = await platform.roborockService.getRoomMap(robot.device.duid, 1, rooms);
    robot.roomInfo = roomData;
    return robot.roomInfo;
  }

  /**
   * Get room map directly from device without caching.
   * Tries to get room info from map information first, then falls back to room maps.
   */
  public static async fromDeviceDirect(device: Device, platform: RoborockMatterbridgePlatform): Promise<RoomMap> {
    const rooms: RoomDto[] = device?.rooms ?? [];

    if (!device || !platform.roborockService) {
      return new RoomMap([]);
    }

    // Try to get map information first
    const mapInfo = await platform.roborockService.getMapInfo(device.duid);
    platform.log.debug(`getRoomMapFromDevice - mapInfo: ${mapInfo ? debugStringify(mapInfo) : 'undefined'}`);
    platform.log.debug(`getRoomMapFromDevice - rooms: ${debugStringify(rooms)}`);

    if (mapInfo.hasRooms) {
      const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
      return new RoomMap(roomMappings);
    }

    // Fall back to room maps
    const roomData = await platform.roborockService.getRoomMap(device.duid, 1, rooms);
    return roomData;
  }
}
