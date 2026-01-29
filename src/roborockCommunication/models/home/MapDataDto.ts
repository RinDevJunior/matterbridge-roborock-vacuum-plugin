import { MapRoomDto } from './MapRoomDto.js';

/** API response: Map backup information */
export interface MapBackupDto {
  mapFlag: number;
  add_time: number;
}

export interface FurnitureDto {
  id: number;
  x: number;
  y: number;
  angle: number;
}

/** API response: Map information from multiple_map endpoint */
export interface MapDataDto {
  mapFlag: number;
  add_time: number;
  length: number;
  name: string;
  bak_maps: MapBackupDto[];
  rooms?: MapRoomDto[];
  furnitures?: FurnitureDto[];
}
