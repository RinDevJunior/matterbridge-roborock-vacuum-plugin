import { describe, it, expect } from 'vitest';
import { RoomIndexMap } from '../../../../core/application/models/RoomIndexMap.js';
import type { AreaInfo, SegmentInfo } from '../../../../initialData/getSupportedAreas.js';

describe('RoomIndexMap', () => {
  it('should create room index map with correct mappings', () => {
    const areaInfo = new Map<number, AreaInfo>([
      [1, { roomId: 10, mapId: 1, roomName: 'roomName-1' }],
      [2, { roomId: 20, mapId: 1, roomName: 'roomName-2' }],
    ]);
    const roomInfo = new Map<string, SegmentInfo>([
      ['10-1', { areaId: 1, mapId: 1, roomName: 'roomName-1' }],
      ['20-1', { areaId: 2, mapId: 1, roomName: 'roomName-2' }],
    ]);

    const indexMap = new RoomIndexMap(areaInfo, roomInfo);

    expect(indexMap.getAreaId(10, 1)).toBe(1);
    expect(indexMap.getAreaId(20, 1)).toBe(2);
    expect(indexMap.getAreaId(30, 1)).toBeUndefined();
    expect(indexMap.getRoomId(3)).toBeUndefined();
  });

  it('should return roomId when areaId exists', () => {
    const areaInfo = new Map<number, AreaInfo>([
      [1, { roomId: 10, mapId: 1, roomName: 'roomName-1' }],
      [2, { roomId: 20, mapId: 1, roomName: 'roomName-2' }],
    ]);
    const roomInfo = new Map<string, SegmentInfo>([]);

    const indexMap = new RoomIndexMap(areaInfo, roomInfo);
    expect(indexMap.getRoomId(1)).toBe(10);
  });
});
