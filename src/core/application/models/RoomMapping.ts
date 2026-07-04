/** Application model: Room with local/global ID mapping and display info */
export interface RoomMapping {
	id: number;
	iot_name_id: string;
	tag: number;
	iot_map_id: number;
	iot_name?: string;
	/** Pre-computed Matter AreaNamespaceTag for B01 devices. When set, bypasses the V10 tag switch. */
	areaType?: number | null;
}
