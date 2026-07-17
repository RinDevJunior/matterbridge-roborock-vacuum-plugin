import { describe, expect, it } from 'vitest';

import {
	normalizeB01RoomName,
	RR_ROOM_TYPE_TOKENS,
} from '../../../../roborockCommunication/map/b01/roomNameNormalizer.js';

describe('normalizeB01RoomName', () => {
	describe('rr_* token map — known tokens', () => {
		it('should return Bedroom for rr_bedroom', () => {
			expect(normalizeB01RoomName('rr_bedroom')).toBe('Bedroom');
		});

		it('should return Kitchen for rr_kitchen', () => {
			expect(normalizeB01RoomName('rr_kitchen')).toBe('Kitchen');
		});

		it('should return Living room for rr_living_room', () => {
			expect(normalizeB01RoomName('rr_living_room')).toBe('Living room');
		});

		it('should return Master bedroom for rr_master_room', () => {
			expect(normalizeB01RoomName('rr_master_room')).toBe('Master bedroom');
		});

		it('should return Guest bedroom for rr_guest_bedroom', () => {
			expect(normalizeB01RoomName('rr_guest_bedroom')).toBe('Guest bedroom');
		});

		it('should return Dining room for rr_restaurant', () => {
			expect(normalizeB01RoomName('rr_restaurant')).toBe('Dining room');
		});

		it('should return Balcony for rr_balcony', () => {
			expect(normalizeB01RoomName('rr_balcony')).toBe('Balcony');
		});

		it('should return Bathroom for rr_toilet', () => {
			expect(normalizeB01RoomName('rr_toilet')).toBe('Bathroom');
		});

		it('should return Entrance hall for rr_entrance_hall', () => {
			expect(normalizeB01RoomName('rr_entrance_hall')).toBe('Entrance hall');
		});

		it('should return Study for rr_study', () => {
			expect(normalizeB01RoomName('rr_study')).toBe('Study');
		});

		it('should return Corridor for rr_corridor', () => {
			expect(normalizeB01RoomName('rr_corridor')).toBe('Corridor');
		});
	});

	describe('rr_other — falls back to default', () => {
		it('should return Room <id> when rr_other and roomId provided', () => {
			expect(normalizeB01RoomName('rr_other', undefined, 5)).toBe('Room 5');
		});

		it('should return Room when rr_other and no roomId', () => {
			expect(normalizeB01RoomName('rr_other', undefined, undefined)).toBe('Room');
		});
	});

	describe('case-insensitive token matching', () => {
		it('should return Bedroom for RR_BEDROOM (all caps)', () => {
			expect(normalizeB01RoomName('RR_BEDROOM')).toBe('Bedroom');
		});

		it('should return Kitchen for Rr_Kitchen (mixed case)', () => {
			expect(normalizeB01RoomName('Rr_Kitchen')).toBe('Kitchen');
		});
	});

	describe('whitespace trimming', () => {
		it('should trim surrounding spaces and resolve rr_bedroom', () => {
			expect(normalizeB01RoomName('  rr_bedroom  ')).toBe('Bedroom');
		});

		it('should treat whitespace-only as empty and use default with roomId', () => {
			expect(normalizeB01RoomName('   ', undefined, 3)).toBe('Room 3');
		});
	});

	describe('empty / absent name — default fallback', () => {
		it('should return Room <id> for empty string with roomId', () => {
			expect(normalizeB01RoomName('', undefined, 7)).toBe('Room 7');
		});

		it('should return Room <id> for undefined with roomId', () => {
			expect(normalizeB01RoomName(undefined, undefined, 7)).toBe('Room 7');
		});

		it('should return Room when empty string with no roomId', () => {
			expect(normalizeB01RoomName('', undefined, undefined)).toBe('Room');
		});
	});

	describe('empty name with roomTypeId — use typeId lookup', () => {
		it('should return Bedroom when typeId 3 (rr_bedroom) with empty name', () => {
			expect(normalizeB01RoomName('', 3, 7)).toBe('Bedroom');
		});

		it('should return Kitchen when typeId 6 (rr_kitchen) with empty name', () => {
			expect(normalizeB01RoomName('', 6, 7)).toBe('Kitchen');
		});

		it('should fall through to default when typeId 0 (rr_other) with empty name', () => {
			expect(normalizeB01RoomName('', 0, 7)).toBe('Room 7');
		});

		it('should fall through to default when typeId is unknown with empty name', () => {
			expect(normalizeB01RoomName('', 99, 7)).toBe('Room 7');
		});
	});

	describe('roomN pattern — title-case style', () => {
		it('should return Room5 for room5', () => {
			expect(normalizeB01RoomName('room5')).toBe('Room5');
		});

		it('should return Room12 for room12 (two digits)', () => {
			expect(normalizeB01RoomName('room12')).toBe('Room12');
		});

		it('should return Room3 for Room3 (case-insensitive match)', () => {
			expect(normalizeB01RoomName('Room3')).toBe('Room3');
		});

		it('should pass through room123 unchanged (three digits — exceeds pattern)', () => {
			expect(normalizeB01RoomName('room123')).toBe('room123');
		});

		it('should return Room0 for room0', () => {
			expect(normalizeB01RoomName('room0')).toBe('Room0');
		});
	});

	describe('user-assigned names — pass through unchanged', () => {
		it('should pass through My Kitchen unchanged', () => {
			expect(normalizeB01RoomName('My Kitchen')).toBe('My Kitchen');
		});

		it('should pass through Master Suite unchanged', () => {
			expect(normalizeB01RoomName('Master Suite')).toBe('Master Suite');
		});

		it('should pass through Bedroom 2 unchanged (contains space — not roomN pattern)', () => {
			expect(normalizeB01RoomName('Bedroom 2')).toBe('Bedroom 2');
		});

		it('should pass through non-ASCII name unchanged', () => {
			expect(normalizeB01RoomName('办公室')).toBe('办公室');
		});
	});
});

describe('RR_ROOM_TYPE_TOKENS', () => {
	it('should be exported and contain exactly 12 keys', () => {
		expect(Object.keys(RR_ROOM_TYPE_TOKENS)).toHaveLength(12);
	});

	it('should map rr_bedroom to Bedroom', () => {
		expect(RR_ROOM_TYPE_TOKENS['rr_bedroom']).toBe('Bedroom');
	});
});
