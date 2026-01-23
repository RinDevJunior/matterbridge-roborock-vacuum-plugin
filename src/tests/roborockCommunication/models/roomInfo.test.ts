import { describe, it, expect } from 'vitest';
import { RoomInfo } from '../../../../src/roborockCommunication/models/roomInfo.js';

describe('Zmodel roomInfo', () => {
  it('constructs and maps room entries', () => {
    const roomInfo = [
      { id: 1, name: 'Kitchen' },
      { id: 2, name: 'Living Room' },
    ];

    // roomData maps local id -> globalId
    const roomData = [
      [10, 1],
      [11, 2],
    ];

    const ri = new RoomInfo(roomInfo, roomData);

    const mapped = ri.rooms;
    expect(mapped).toHaveLength(2);
    expect(mapped.map((r) => r.id)).toEqual([10, 11]);
    expect(mapped.find((r) => r.id === 10)?.name).toBe('kitchen');
    expect(mapped.find((r) => r.id === 11)?.name).toBe('living room');
  });
});
