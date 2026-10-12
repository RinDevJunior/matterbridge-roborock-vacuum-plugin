import { describe, expect, it } from 'vitest';

import { normalizeB01RoomName } from '../../../../roborockCommunication/map/b01/roomNameNormalizer.js';

describe('normalizeB01RoomName', () => {
	it('should return the type label when name is empty and roomTypeId maps to a known room type', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('', 4);
		// Assert
		expect(result).toBe('Living room');
	});

	it('should return the type label when name is whitespace-only and roomTypeId is known', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('   ', 6);
		// Assert
		expect(result).toBe('Kitchen');
	});

	it('should return the room id default when name is empty and roomTypeId is rr_other', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('', 0, 3);
		// Assert
		expect(result).toBe('Room 3');
	});

	it('should return bare Room when name is empty and neither roomTypeId nor roomId is provided', () => {
		// Arrange / Act
		const result = normalizeB01RoomName(undefined);
		// Assert
		expect(result).toBe('Room');
	});

	it('should return the room id default when name is empty and roomTypeId is outside the known table', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('', 99, 7);
		// Assert
		expect(result).toBe('Room 7');
	});

	it('should return the English label when name is an rr_ token in mixed case', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('RR_Kitchen');
		// Assert
		expect(result).toBe('Kitchen');
	});

	it('should return the room id default when name is rr_other with an id', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('rr_other', undefined, 2);
		// Assert
		expect(result).toBe('Room 2');
	});

	it('should return bare Room when name is rr_other and no roomId is provided', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('rr_other');
		// Assert
		expect(result).toBe('Room');
	});

	it.each([
		['room5', 'Room5'],
		['ROOM12', 'Room12'],
	])('should normalize roomN pattern %s to %s', (input, expected) => {
		// Arrange / Act
		const result = normalizeB01RoomName(input);
		// Assert
		expect(result).toBe(expected);
	});

	it('should pass through roomN-like names with three digits unchanged', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('room123');
		// Assert
		expect(result).toBe('room123');
	});

	it('should pass through custom names trimmed when they do not match any rule', () => {
		// Arrange / Act
		const result = normalizeB01RoomName('  Kids Room  ');
		// Assert
		expect(result).toBe('Kids Room');
	});
});
