import { ServiceArea } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { RoomIndexMap } from '../../core/application/models/index.js';
import { mergeSupportedAreasByMap } from '../../initialData/mergeSupportedAreasByMap.js';
import { asPartial } from '../helpers/testUtils.js';

function makeArea(areaId: number, mapId: number): ServiceArea.Area {
	return asPartial<ServiceArea.Area>({ areaId, mapId });
}

describe('mergeSupportedAreasByMap gap coverage', () => {
	it('should skip kept areas that have no entry in the existing index map', () => {
		// Arrange
		const existingAreas = [makeArea(0, 1), makeArea(1, 2)];
		const existingIndexMap = new RoomIndexMap(new Map(), new Map());
		const incomingIndexMap = new RoomIndexMap(new Map(), new Map());

		// Act
		const result = mergeSupportedAreasByMap(existingAreas, [], 2, existingIndexMap, incomingIndexMap);

		// Assert
		expect(result.supportedAreas).toHaveLength(1);
		expect(result.roomIndexMap.getRoomId(0)).toBeUndefined();
		expect(result.roomIndexMap.roomInfo.size).toBe(0);
	});

	it('should skip kept areas when the existing index map is undefined', () => {
		// Arrange
		const existingAreas = [makeArea(0, 1)];
		const incomingIndexMap = new RoomIndexMap(new Map(), new Map());

		// Act
		const result = mergeSupportedAreasByMap(existingAreas, [], 2, undefined, incomingIndexMap);

		// Assert
		expect(result.supportedAreas).toHaveLength(1);
		expect(result.roomIndexMap.getRoomId(0)).toBeUndefined();
	});

	it('should key a kept room with null mapId under map 0 when re-indexing', () => {
		// Arrange
		const existingAreas = [makeArea(0, 1)];
		const existingIndexMap = new RoomIndexMap(new Map([[0, { roomId: 5, mapId: null, roomName: 'Hall' }]]), new Map());
		const incomingIndexMap = new RoomIndexMap(new Map(), new Map());

		// Act
		const result = mergeSupportedAreasByMap(existingAreas, [], 2, existingIndexMap, incomingIndexMap);

		// Assert
		expect(result.roomIndexMap.getAreaId(5, 0)).toBe(0);
		expect(result.roomIndexMap.getRoomId(0)).toBe(5);
	});

	it('should key an incoming room with null mapId under the mapId argument', () => {
		// Arrange
		const incomingAreas = [makeArea(0, 2)];
		const incomingIndexMap = new RoomIndexMap(
			new Map([[0, { roomId: 9, mapId: null, roomName: 'Bedroom' }]]),
			new Map(),
		);

		// Act
		const result = mergeSupportedAreasByMap([], incomingAreas, 2, undefined, incomingIndexMap);

		// Assert
		expect(result.roomIndexMap.getAreaId(9, 2)).toBe(0);
		expect(result.roomIndexMap.getRoomId(0)).toBe(9);
	});
});
