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

  describe('getAreaIdV2', () => {
    it('should return areaId when roomId key prefix matches', () => {
      const areaInfo = new Map<number, AreaInfo>();
      const roomInfo = new Map<string, SegmentInfo>([
        ['10-1', { areaId: 1, mapId: 1, roomName: 'roomName-1' }],
        ['20-2', { areaId: 2, mapId: 2, roomName: 'roomName-2' }],
      ]);

      const indexMap = new RoomIndexMap(areaInfo, roomInfo);

      expect(indexMap.getAreaIdV2(10)).toBe(1);
      expect(indexMap.getAreaIdV2(20)).toBe(2);
    });

    it('should return undefined when no key starts with the roomId prefix', () => {
      const areaInfo = new Map<number, AreaInfo>();
      const roomInfo = new Map<string, SegmentInfo>([['10-1', { areaId: 1, mapId: 1, roomName: 'roomName-1' }]]);

      const indexMap = new RoomIndexMap(areaInfo, roomInfo);

      expect(indexMap.getAreaIdV2(99)).toBeUndefined();
    });

    it('should return undefined when roomInfo is empty', () => {
      const areaInfo = new Map<number, AreaInfo>();
      const roomInfo = new Map<string, SegmentInfo>();

      const indexMap = new RoomIndexMap(areaInfo, roomInfo);

      expect(indexMap.getAreaIdV2(10)).toBeUndefined();
    });

    it('should return the first matching areaId when multiple map ids exist for same room', () => {
      const areaInfo = new Map<number, AreaInfo>();
      const roomInfo = new Map<string, SegmentInfo>([
        ['10-1', { areaId: 5, mapId: 1, roomName: 'roomName-1' }],
        ['10-2', { areaId: 6, mapId: 2, roomName: 'roomName-1-map2' }],
      ]);

      const indexMap = new RoomIndexMap(areaInfo, roomInfo);

      expect(indexMap.getAreaIdV2(10)).toBe(5);
    });
  });
});
