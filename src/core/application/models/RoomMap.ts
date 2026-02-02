import { RoomMapping } from './RoomMapping.js';
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
  public static async fromMapInfo(device: Device, platform: RoborockMatterbridgePlatform): Promise<RoomMap> {
    if (!platform.roborockService) {
      platform.log.error('Roborock service not initialized');
      return new RoomMap([]);
    }

    const rooms = device.rooms;

    // Try to get map information first
    const mapInfo = await platform.roborockService.getMapInfo(device.duid);
    device.mapInfos = mapInfo.maps;

    if (mapInfo.hasRooms) {
      platform.log.info(`fromMapInfo - mapInfo: ${debugStringify(mapInfo)}`);
      platform.log.info(`fromMapInfo - rooms: ${debugStringify(rooms)}`);
      const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
      return new RoomMap(roomMappings);
    }

    const activeMap = 1;

    // Fall back to room maps
    const roomData = await platform.roborockService.getRoomMap(device.duid, activeMap);

    const mapRoomDtos = roomData.map((raw) => HomeModelMapper.rawArrayToMapRoomDto(raw, activeMap));
    const roomMappings = mapRoomDtos.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
    const roomMap = new RoomMap(roomMappings);

    platform.log.debug(`fromMapInfo - Room mapping for device ${device.duid}: ${debugStringify(roomMap)}`);

    return roomMap;
  }
}
