interface MapBackupInformation {
  mapFlag: number;
  add_time: number;
}

export interface MapInformation {
  mapFlag: number;
  add_time: number;
  length: number;
  name: string;
  rooms?: RoomInformation[] | undefined;
  bak_maps: MapBackupInformation[];
}

export interface RoomInformation {
  id: number;
  tag: number;
  iot_name_id: string;
  iot_name: string;
}
