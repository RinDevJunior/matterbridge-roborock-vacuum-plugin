import { RoomMapping } from './RoomMapping.js';
import { HomeModelMapper } from '../../../roborockCommunication/models/home/mappers.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { debugStringify } from 'matterbridge/logger';
import { Device } from '../../../roborockCommunication/models/device.js';
import { MapInfo } from './MapInfo.js';
import type { RoborockService } from '../../../services/roborockService.js';

export interface MapInfoPlatformContext {
  roborockService: RoborockService | undefined;
  log: AnsiLogger;
}

export interface MapReference {
  id: number;
  name: string | undefined;
}

export interface MapInfoResult {
  activeMapId: number;
  mapInfo: MapInfo;
  roomMap: RoomMap;
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
  public static async fromMapInfo(vacuum: Device, context: MapInfoPlatformContext): Promise<MapInfoResult> {
    if (!context.roborockService) {
      context.log.error('Roborock service not initialized');
      return { activeMapId: 0, mapInfo: MapInfo.empty(), roomMap: RoomMap.empty() };
    }

    const rooms = vacuum.store.homeData.rooms;

    // Try to get map information first
    const mapInfo = await context.roborockService.getMapInfo(vacuum.duid);
    const roomData = await context.roborockService.getRoomMap(vacuum.duid, -1);

    vacuum.mapInfos = mapInfo.maps;
    let activeMapId = mapInfo.maps?.[0]?.id ?? 0;
    if (mapInfo.hasRooms) {
      context.log.info(`fromMapInfo - mapInfo: ${debugStringify(mapInfo)}`);
      context.log.info(`fromMapInfo - rooms: ${debugStringify(rooms)}`);
      const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
      activeMapId = mapInfo.getActiveMapId(roomData);

      return { activeMapId: activeMapId, mapInfo, roomMap: new RoomMap(roomMappings) };
    }

    // // Fall back to room maps

    const mapRoomDtos = roomData.map((raw) => HomeModelMapper.rawArrayToMapRoomDto(raw, activeMapId));
    const roomMappings = mapRoomDtos.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
    const roomMap = new RoomMap(roomMappings);

    context.log.debug(`fromMapInfo - Room mapping for device ${vacuum.duid}: ${debugStringify(roomMap)}`);

    return { activeMapId: activeMapId, mapInfo, roomMap };
  }

  public static empty(): RoomMap {
    return new RoomMap([]);
  }
}
