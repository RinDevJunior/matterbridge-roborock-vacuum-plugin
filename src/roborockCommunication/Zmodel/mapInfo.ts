import decodeComponent from '../helper/nameDecoder.js';
import { RoomInformation } from './map.js';
import type { MultipleMap } from './multipleMap.js';

export interface MapRoom {
  id: number;
  iot_name_id: string;
  tag: number;
  globalId?: number;
  displayName?: string;
  mapId?: number;
}

export interface MapEntry {
  id: number;
  name: string | undefined;
  rooms: MapRoom[];
}

export class MapInfo {
  public readonly maps: MapEntry[] = [];
  public readonly allRooms: MapRoom[] = [];

  constructor(multimap: MultipleMap) {
    this.maps = multimap.map_info.map((mapInfo) => {
      const rooms: MapRoom[] = mapInfo.rooms.map((room: RoomInformation) => ({
        id: room.id,
        globalId: parseInt(room.iot_name_id),
        iot_name_id: room.iot_name_id,
        tag: room.tag,
        displayName: room.iot_name,
        mapId: mapInfo.mapFlag,
      }));

      this.allRooms.push(...rooms);
      return {
        id: mapInfo.mapFlag,
        name: decodeComponent(mapInfo.name),
        rooms,
      };
    });

    //this.allRooms = this.allRooms.filter((room, index, self) => index === self.findIndex((r) => r.globalId === room.globalId));
  }

  getById(id: number): string | undefined {
    return this.maps.find((m) => m.id === id)?.name;
  }

  getByName(name: string): number | undefined {
    return this.maps.find((m) => m.name?.toLowerCase() === name.toLowerCase())?.id;
  }
}
