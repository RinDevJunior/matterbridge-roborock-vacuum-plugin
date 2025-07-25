export interface Map {
  mapFlag: number;
  add_time: number;
  length: number;
  name: string;
  rooms: RoomInformation[];
  bak_maps: { mapFlag: number; add_time: number }[];
}

export interface RoomInformation {
  id: number;
  tag: number;
  iot_name_id: string;
  iot_name: string;
}
