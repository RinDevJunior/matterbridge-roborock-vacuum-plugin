import { describe, expect, it } from 'vitest';

import { extractNamedRooms, resolveActiveMapId, roomDisplayName } from '../../cli/mapListHelpers.js';
import type { LegacyNamedRoom } from '../../roborockCommunication/map/v1/mapParser.js';

describe('mapListHelpers', () => {
	describe('resolveActiveMapId', () => {
		it('should return mapFlag when map_status is present', () => {
			expect(resolveActiveMapId({ map_status: 4 })).toBe(1);
		});

		it('should return undefined when map_status encodes sentinel 63', () => {
			expect(resolveActiveMapId({ map_status: 252 })).toBeUndefined();
		});

		it('should return undefined when map_status is missing', () => {
			expect(resolveActiveMapId({})).toBeUndefined();
		});
	});

	describe('extractNamedRooms', () => {
		const mapResult = {
			map_info: [
				{
					mapFlag: 0,
					rooms: [
						{ id: 16, iot_name: 'Living Room' },
						{ id: 17, iot_name: 'Kitchen' },
					],
				},
				{
					mapFlag: 1,
					rooms: [{ id: 16, iot_name: 'Other Map Room' }],
				},
			],
		};

		it('should return only rooms from the active map when activeMapId is set', () => {
			const result = extractNamedRooms(mapResult, 0);

			expect(result).toEqual([
				{ id: 16, name: 'Living Room' },
				{ id: 17, name: 'Kitchen' },
			]);
		});

		it('should return empty array when activeMapId is undefined', () => {
			expect(extractNamedRooms(mapResult, undefined)).toEqual([]);
		});

		it('should return empty name when iot_name is missing', () => {
			const result = extractNamedRooms(
				{
					map_info: [
						{
							mapFlag: 0,
							rooms: [{ id: 16 }],
						},
					],
				},
				0,
			);

			expect(result).toEqual([{ id: 16, name: '' }]);
		});
	});

	describe('roomDisplayName', () => {
		const namedRooms: LegacyNamedRoom[] = [
			{ id: 16, name: 'Living Room' },
			{ id: 17, name: 'Kitchen' },
		];

		it('should return room name when segment id matches', () => {
			expect(roomDisplayName(16, namedRooms)).toBe('Living Room');
		});

		it('should return empty string when segment id is not found', () => {
			expect(roomDisplayName(99, namedRooms)).toBe('');
		});
	});
});
