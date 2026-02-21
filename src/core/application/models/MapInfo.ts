import {
  MapDataDto,
  MapRoomDto,
  MultipleMapDto,
  RawRoomMappingData,
} from '../../../roborockCommunication/models/home/index.js';
import decodeComponent from '../../../roborockCommunication/helper/nameDecoder.js';

export interface MapEntry {
  id: number;
  name: string | undefined;
  rooms: MapRoomDto[];
}

/** Application model: Aggregates and processes map information */
export class MapInfo {
  public readonly maps: MapEntry[] = [];
  public readonly allRooms: MapRoomDto[] = [];

  constructor(multimap: MultipleMapDto) {
    this.maps = multimap.map_info.map((mapInfo: MapDataDto, index: number) => {
      const entry = this.toMapEntry(mapInfo, index);
      this.allRooms.push(...entry.rooms);
      return entry;
    });
  }

  private toMapEntry(mapInfo: MapDataDto, index: number): MapEntry {
    const hasName = mapInfo.name !== undefined && mapInfo.name !== '';
    return {
      id: mapInfo.mapFlag,
      name: hasName ? decodeComponent(mapInfo.name) : `Default Map ${index + 1}`,
      rooms: mapInfo.rooms?.map((room) => ({ ...room, iot_map_id: mapInfo.mapFlag }) satisfies MapRoomDto) ?? [],
    };
  }

  getById(id: number): string | undefined {
    return this.maps.find((m) => m.id === id)?.name;
  }

  getByName(name: string): number | undefined {
    return this.maps.find((m) => m.name?.toLowerCase() === name.toLowerCase())?.id;
  }

  get hasRooms(): boolean {
    return this.allRooms.length > 0;
  }

  public static empty(): MapInfo {
    return new MapInfo({
      max_multi_map: 0,
      max_bak_map: 0,
      multi_map_count: 0,
      map_info: [],
    });
  }

  public getActiveMapId(roomData: RawRoomMappingData): number {
    const match = this.maps.find((map) => {
      if (roomData.length !== map.rooms.length) return false;
      return roomData.every((entry) => map.rooms.some((r) => r.id === entry[0] && r.iot_name_id === entry[1]));
    });
    return match?.id ?? 0;
  }
}
