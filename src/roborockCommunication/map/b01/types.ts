export interface B01RoomInfo {
  roomId: number;
  roomName: string;
  roomTypeId?: number;
  colorId?: number;
  labelPos?: { x: number; y: number };
}

export interface B01MapInfo {
  rooms: B01RoomInfo[];
}
