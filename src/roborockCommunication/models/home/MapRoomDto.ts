/** API response: Room with map context from map_info endpoint */

/**
 * @property id - Room ID
 * @property tag - Room tag
 * @property iot_name_id - IoT name ID
 * @property iot_name - IoT name (optional)
 * @property iot_map_id - (Optional) IoT map ID for enhanced identification
 * @property globalId - (Optional) Global ID for enhanced identification
 */
export interface MapRoomDto {
  id: number;
  tag: number;
  iot_name_id: string;
  iot_name?: string;

  /* Optional fields for enhanced identification */
  iot_map_id?: number;
}
