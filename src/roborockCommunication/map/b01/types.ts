export interface B01RoomInfo {
	roomId: number;
	roomName: string;
	roomTypeId?: number;
	colorId?: number;
	labelPos?: { x: number; y: number };
}

export interface B01Pose {
	x: number;
	y: number;
	phi?: number;
}

export interface B01RoomMatrix {
	/** Grid bytes (one byte per cell, `(byte & 0xFC) >> 2` decodes the roomId). */
	data: Buffer;
	width: number;
	height: number;
	originX: number;
	originY: number;
	roomIds: number[];
}

export interface B01MapInfo {
	rooms: B01RoomInfo[];
	mapId?: number;
	currentPose?: B01Pose;
	roomMatrix?: B01RoomMatrix;
}
