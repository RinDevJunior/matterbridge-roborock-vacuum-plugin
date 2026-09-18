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

export interface B01GridOrigin {
	/** Pixel-space origin X, already converted from raw 5mm header units (origin_raw / 10). */
	x: number;
	/** Pixel-space origin Y, same conversion as x. */
	y: number;
	/** Grid resolution in mm-per-pixel (header resolution_raw * 10; observed constant 50). */
	resolutionMmPerPixel: number;
}

export interface B01RoomMatrix {
	/** Raw undecoded matrix bytes as received from the RobotMap protobuf push. */
	data: Buffer;
	width: number;
	height: number;
	/** Undefined when the header frame was a null/keepalive frame (origin_x==origin_y==0 raw) or fields were absent — callers MUST treat this as "no usable calibration". */
	origin?: B01GridOrigin;
}

export interface B01MapInfo {
	rooms: B01RoomInfo[];
	mapId?: number;
	currentPose?: B01Pose;
	roomMatrix?: B01RoomMatrix;
	/** Diagnostic-only, unconfirmed: raw header byte 6 (meaning unknown). */
	headerUnknownByte6?: number;
	/** Diagnostic-only, unconfirmed: raw header bytes 11-26 (meaning unknown). */
	headerReserved?: Buffer;
}
