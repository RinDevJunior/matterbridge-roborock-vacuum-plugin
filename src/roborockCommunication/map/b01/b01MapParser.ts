import * as protobuf from 'protobufjs';
import { ROBOROCK_PROTO_STR } from './roborockProto.js';
import { B01RoomInfo, B01MapInfo } from './types.js';

export class B01MapParser {
  private readonly robotMapType: protobuf.Type;

  constructor() {
    const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
    this.robotMapType = root.lookupType('SCMap.RobotMap');
  }

  public parseRooms(buffer: Buffer): B01MapInfo {
    const decoded: Record<string, unknown> = this.robotMapType.decode(buffer) as unknown as Record<string, unknown>;
    const roomDataInfo = decoded.roomDataInfo as Record<string, unknown>[] | undefined;

    if (!roomDataInfo || roomDataInfo.length === 0) {
      return { rooms: [] };
    }

    const rooms: B01RoomInfo[] = roomDataInfo.map((r) => {
      const namePost = r.roomNamePost as { x: number; y: number } | undefined;
      return {
        roomId: r.roomId as number,
        roomName: (r.roomName as string) || '',
        roomTypeId: r.roomTypeId as number | undefined,
        colorId: r.colorId as number | undefined,
        labelPos: namePost ? { x: namePost.x, y: namePost.y } : undefined,
      };
    });

    return { rooms };
  }
}
