export interface Q10RoomInfo {
	roomId: number;
	roomName: string;
	/** Grid cell byte value painted for this room: (roomId * 4) & 0xFF. */
	pixelValue: number;
}

export interface Q10GridCalibration {
	originX: number;
	originY: number;
	resolution: number;
}

export interface Q10MapPacket {
	mapId: number;
	width: number;
	height: number;
	/** Row-major, width*height bytes, one byte per grid cell (row 0 first). */
	grid: Buffer;
	rooms: Q10RoomInfo[];
	calibration: Q10GridCalibration;
}

export interface Q10RobotPosition {
	x: number;
	y: number;
}
