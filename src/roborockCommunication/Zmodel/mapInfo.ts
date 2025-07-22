import decodeComponent from '../helper/nameDecoder.js';
import { RoomInformation } from './map.js';
import type { MultipleMap } from './multipleMap.js';
import { Room } from './room.js';

export class MapInfo {
  readonly maps: { id: number; name: string | undefined; rooms: Room[] }[] = [];

  constructor(multimap: MultipleMap) {
    multimap.map_info.forEach((map) => {
      this.maps.push({
        id: map.mapFlag,
        name: decodeComponent(map.name)?.toLowerCase(),
        rooms:
          map.rooms && map.rooms.length > 0
            ? map.rooms.map((room: RoomInformation) => {
                return {
                  id: room.iot_name_id,
                  name: room.iot_name,
                } as unknown as Room;
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
