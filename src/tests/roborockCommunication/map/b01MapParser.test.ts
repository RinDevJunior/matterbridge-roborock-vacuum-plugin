import { describe, it, expect, beforeEach } from 'vitest';
import * as protobuf from 'protobufjs';
import { B01MapParser } from '../../../roborockCommunication/map/b01/b01MapParser.js';
import { ROBOROCK_PROTO_STR } from '../../../roborockCommunication/map/b01/roborockProto.js';

function encodeRobotMap(roomDataInfo: Record<string, unknown>[]): Buffer {
  const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
  const robotMapType = root.lookupType('SCMap.RobotMap');
  const message = robotMapType.create({ mapType: 1, roomDataInfo });
  return Buffer.from(robotMapType.encode(message).finish());
}

describe('B01MapParser', () => {
  let parser: B01MapParser;

  beforeEach(() => {
    parser = new B01MapParser();
  });

  it('should parse rooms from a valid protobuf buffer', () => {
    const buffer = encodeRobotMap([
      { roomId: 1, roomName: 'Living Room', roomTypeId: 2, colorId: 5, roomNamePost: { x: 10.5, y: 20.3 } },
      { roomId: 2, roomName: 'Kitchen', roomTypeId: 3, colorId: 7, roomNamePost: { x: 30.0, y: 40.0 } },
    ]);

    const result = parser.parseRooms(buffer);

    expect(result.rooms).toHaveLength(2);
    expect(result.rooms[0].roomId).toBe(1);
    expect(result.rooms[0].roomName).toBe('Living Room');
    expect(result.rooms[0].roomTypeId).toBe(2);
    expect(result.rooms[0].colorId).toBe(5);
    expect(result.rooms[0].labelPos?.x).toBeCloseTo(10.5, 1);
    expect(result.rooms[0].labelPos?.y).toBeCloseTo(20.3, 1);

    expect(result.rooms[1].roomId).toBe(2);
    expect(result.rooms[1].roomName).toBe('Kitchen');
    expect(result.rooms[1].roomTypeId).toBe(3);
    expect(result.rooms[1].colorId).toBe(7);
    expect(result.rooms[1].labelPos?.x).toBeCloseTo(30.0, 1);
    expect(result.rooms[1].labelPos?.y).toBeCloseTo(40.0, 1);
  });

  it('should return empty rooms when roomDataInfo is empty', () => {
    const buffer = encodeRobotMap([]);
    const result = parser.parseRooms(buffer);
    expect(result.rooms).toEqual([]);
  });

  it('should return empty rooms when roomDataInfo is missing', () => {
    const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
    const robotMapType = root.lookupType('SCMap.RobotMap');
    const message = robotMapType.create({ mapType: 1 });
    const buffer = Buffer.from(robotMapType.encode(message).finish());

    const result = parser.parseRooms(buffer);
    expect(result.rooms).toEqual([]);
  });

  it('should handle rooms without roomNamePost', () => {
    const buffer = encodeRobotMap([{ roomId: 5, roomName: 'Bedroom', roomTypeId: 1 }]);

    const result = parser.parseRooms(buffer);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].roomId).toBe(5);
    expect(result.rooms[0].roomName).toBe('Bedroom');
    expect(result.rooms[0].labelPos).toBeUndefined();
  });

  it('should handle rooms without roomName', () => {
    const buffer = encodeRobotMap([{ roomId: 3 }]);

    const result = parser.parseRooms(buffer);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].roomId).toBe(3);
    expect(result.rooms[0].roomName).toBe('');
  });

  it('should handle rooms without optional fields defaulting to protobuf zero values', () => {
    const buffer = encodeRobotMap([{ roomId: 7, roomName: 'Bathroom' }]);

    const result = parser.parseRooms(buffer);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].roomId).toBe(7);
    expect(result.rooms[0].roomName).toBe('Bathroom');
  });
});
