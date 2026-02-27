import { describe, it, expect } from 'vitest';
import { MapRoom } from '../../../../core/application/models/MapRoom.js';
import type { MapRoomDto } from '../../../../roborockCommunication/models/home/index.js';

describe('MapRoom', () => {
  describe('constructor', () => {
    it('should store all properties', () => {
      const room = new MapRoom(1, 'room1', 'Living Room', '10', 5);
      expect(room.id).toBe(1);
      expect(room.iot_name_id).toBe('room1');
      expect(room.iot_name).toBe('Living Room');
      expect(room.alternativeId).toBe('10');
      expect(room.iot_map_id).toBe(5);
    });

    it('should allow undefined iot_name_id and iot_map_id', () => {
      const room = new MapRoom(2, undefined, 'Bedroom', '20', undefined);
      expect(room.iot_name_id).toBeUndefined();
      expect(room.iot_map_id).toBeUndefined();
    });
  });

  describe('fromDto', () => {
    it('should create MapRoom from dto with all fields', () => {
      const dto: MapRoomDto = { id: 3, tag: 2, iot_name_id: 'room3', iot_map_id: 10 };
      const room = MapRoom.fromDto(dto, 'Kitchen');

      expect(room.id).toBe(3);
      expect(room.iot_name_id).toBe('room3');
      expect(room.iot_name).toBe('Kitchen');
      expect(room.alternativeId).toBe('32');
      expect(room.iot_map_id).toBe(10);
    });

    it('should set alternativeId as id+tag concatenation', () => {
      const dto: MapRoomDto = { id: 5, tag: 7, iot_name_id: 'room5' };
      const room = MapRoom.fromDto(dto, 'Study');
      expect(room.alternativeId).toBe('57');
    });

    it('should use empty string for tag when tag is 0', () => {
      const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'room1' };
      const room = MapRoom.fromDto(dto, 'Hall');
      expect(room.alternativeId).toBe('10');
    });

    it('should set iot_map_id to undefined when not provided in dto', () => {
      const dto: MapRoomDto = { id: 4, tag: 1, iot_name_id: 'room4' };
      const room = MapRoom.fromDto(dto, 'Bathroom');
      expect(room.iot_map_id).toBeUndefined();
    });
  });
});
