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
	/** Raw undecoded matrix bytes as received from the RobotMap protobuf push. */
	data: Buffer;
}

export interface B01MapInfo {
	rooms: B01RoomInfo[];
	mapId?: number;
	currentPose?: B01Pose;
	roomMatrix?: B01RoomMatrix;
}
