/** Application model: Room with local/global ID mapping and display info */
export interface RoomMapping {
  id: number;
  globalId?: number;
  iot_name_id: string;
  tag: number;
  iot_map_id: number;
  iot_name?: string;
}
