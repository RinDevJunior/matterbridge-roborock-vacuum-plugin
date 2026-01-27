import { MapDataDto } from './MapDataDto.js';

/** API response: Container for multiple maps */
export interface MultipleMapDto {
  max_multi_map: number;
  max_bak_map: number;
  multi_map_count: number;
  map_info: MapDataDto[];
}
