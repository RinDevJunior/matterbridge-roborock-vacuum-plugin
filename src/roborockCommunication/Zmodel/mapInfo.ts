import decodeComponent from '../helper/nameDecoder.js';
import { RoomInformation } from './map.js';
import type { MultipleMap } from './multipleMap.js';

export class MapInfo {
  readonly maps: { id: number; name: string | undefined; rooms: { id: number; iot_name_id: string; tag: number; displayName: string }[] }[] = [];

  constructor(multimap: MultipleMap) {
    multimap.map_info.forEach((map) => {
      this.maps.push({
        id: map.mapFlag,
        name: decodeComponent(map.name)?.toLowerCase(),
        rooms:
          map.rooms && map.rooms.length > 0
            ? map.rooms.map((room: RoomInformation) => {
                return {
                  id: room.id,
                  iot_name_id: room.iot_name_id,
                  tag: room.tag,
                  displayName: room.iot_name,
                };
              })
            : [],
      });
    });
  }

  getById(id: number): string | undefined {
    return this.maps.find((m) => m.id === id)?.name;
  }

  getByName(name: string): number | undefined {
    return this.maps.find((m) => m.name === name.toLowerCase())?.id;
  }
}
