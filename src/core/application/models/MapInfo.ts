import { MapDataDto, MapRoomDto, MultipleMapDto } from '../../../roborockCommunication/models/home/index.js';
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
      const rooms =
        mapInfo.rooms?.map((room) => ({
          ...room,
          mapId: mapInfo.mapFlag,
        })) ?? [];

      this.allRooms.push(...rooms);
      return {
        id: mapInfo.mapFlag,
        name: mapInfo.name !== undefined && mapInfo.name !== '' ? decodeComponent(mapInfo.name) : `Default Map ${index + 1}`,
        rooms,
      };
    });
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
}
