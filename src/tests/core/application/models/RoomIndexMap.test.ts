import { describe, it, expect } from 'vitest';
import { RoomIndexMap } from '../../../../core/application/models/RoomIndexMap.js';
import type { MapInfo } from '../../../../initialData/getSupportedAreas.js';

describe('RoomIndexMap', () => {
  it('should create room index map with correct mappings', () => {
    const roomMap = new Map<number, MapInfo>([
      [1, { roomId: 10, mapId: 1, name: 'Kitchen' }],
      [2, { roomId: 20, mapId: 1, name: 'Bedroom' }],
    ]);

    const indexMap = new RoomIndexMap(roomMap);

    expect(indexMap.indexMap).toBe(roomMap);
    expect(indexMap.roomMap.size).toBe(2);
    expect(indexMap.roomMap.get('10:1')).toBe(1);
    expect(indexMap.roomMap.get('20:1')).toBe(2);
  });

  it('should return areaId when room and map exist', () => {
    const roomMap = new Map<number, MapInfo>([[1, { roomId: 10, mapId: 1, name: 'Kitchen' }]]);
    const indexMap = new RoomIndexMap(roomMap);

    expect(indexMap.getAreaId(10, 1)).toBe(1);
  });

  it('should return undefined when room and map do not exist', () => {
    const roomMap = new Map<number, MapInfo>([[1, { roomId: 10, mapId: 1, name: 'Kitchen' }]]);
    const indexMap = new RoomIndexMap(roomMap);

    expect(indexMap.getAreaId(99, 1)).toBeUndefined();
  });

  it('should return roomId when areaId exists', () => {
    const roomMap = new Map<number, MapInfo>([[1, { roomId: 10, mapId: 1, name: 'Kitchen' }]]);
    const indexMap = new RoomIndexMap(roomMap);

    expect(indexMap.getRoomId(1)).toBe(10);
  });

  it('should return undefined when areaId does not exist', () => {
    const roomMap = new Map<number, MapInfo>([[1, { roomId: 10, mapId: 1, name: 'Kitchen' }]]);
    const indexMap = new RoomIndexMap(roomMap);

    expect(indexMap.getRoomId(99)).toBeUndefined();
  });
});
