import { randomInt } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapInfo, RoomMap } from '../../core/application/models/index.js';
import type { RoomMapping } from '../../core/application/models/RoomMapping.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import { getSupportedAreas, toSupportedMaps } from '../../initialData/getSupportedAreas.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

vi.mock('node:crypto', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, randomInt: vi.fn() };
});

function createMapInfo(entries: { id: number; name: string }[]): MapInfo {
	return new MapInfo({
		max_multi_map: entries.length,
		max_bak_map: 0,
		multi_map_count: entries.length,
		map_info: entries.map((entry) => ({
			mapFlag: entry.id,
			add_time: 0,
			length: 0,
			name: entry.name,
			bak_maps: [],
			rooms: [],
		})),
	});
}

function createHomeEntity(rooms: RoomMapping[], mapInfo: MapInfo = MapInfo.empty()): HomeEntity {
	return new HomeEntity(1, 'Test Home', new RoomMap(rooms), mapInfo, 0);
}

describe('getSupportedAreas gap coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(randomInt).mockImplementation(() => 4242);
	});

	describe('toSupportedMaps', () => {
		it('should return all maps when enableMultipleMap is omitted', () => {
			// Arrange
			const mapInfo = createMapInfo([
				{ id: 7, name: 'Ground' },
				{ id: 8, name: 'Upstairs' },
			]);

			// Act
			const result = toSupportedMaps(mapInfo);

			// Assert
			expect(result).toEqual([
				{ mapId: 7, name: 'Ground' },
				{ mapId: 8, name: 'Upstairs' },
			]);
		});

		it('should fall back to Map <id> when a map name is undefined', () => {
			// Arrange
			const mapInfo = asPartial<MapInfo>({ maps: [{ id: 7, name: undefined, rooms: [] }] });

			// Act
			const result = toSupportedMaps(mapInfo);

			// Assert
			expect(result).toEqual([{ mapId: 7, name: 'Map 7' }]);
		});
	});

	describe('getSupportedAreas', () => {
		it('should expose all maps when enableMultipleMap is omitted', () => {
			// Arrange
			const logger = createMockLogger();
			const rooms: RoomMapping[] = [
				{ id: 1, iot_name_id: '1', tag: 0, iot_map_id: 7, iot_name: 'Kitchen' },
				{ id: 2, iot_name_id: '2', tag: 0, iot_map_id: 8, iot_name: 'Den' },
			];
			const homeEntity = createHomeEntity(
				rooms,
				createMapInfo([
					{ id: 7, name: 'Ground' },
					{ id: 8, name: 'Upstairs' },
				]),
			);

			// Act
			const result = getSupportedAreas(homeEntity, logger);

			// Assert
			expect(result.supportedMaps.map((m) => m.mapId)).toEqual([7, 8]);
		});

		it('should log an undefined roomMap and return the fallback area when roomMap is undefined', () => {
			// Arrange
			const logger = createMockLogger();
			const homeEntity = asPartial<HomeEntity>({ rawRooms: [], roomMap: undefined });

			// Act
			const result = getSupportedAreas(homeEntity, logger);

			// Assert
			expect(logger.debug).toHaveBeenCalledWith('getSupportedAreas-roomMap', 'undefined');
			expect(result.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toBe('Unknown - No Room');
		});

		it('should log only No rooms found when rawRooms is empty but roomMap has rooms', () => {
			// Arrange
			const logger = createMockLogger();
			const homeEntity = asPartial<HomeEntity>({
				rawRooms: [],
				roomMap: new RoomMap([{ id: 1, iot_name_id: '1', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' }]),
			});

			// Act
			getSupportedAreas(homeEntity, logger);

			// Assert
			expect(logger.error).toHaveBeenCalledWith('No rooms found');
			expect(logger.error).not.toHaveBeenCalledWith('No room map found');
		});

		it('should log only No room map found when roomMap has no rooms but rawRooms is non-empty', () => {
			// Arrange
			const logger = createMockLogger();
			const homeEntity = asPartial<HomeEntity>({
				rawRooms: [{ id: 1, iot_name_id: '1', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' }],
				roomMap: RoomMap.empty(),
			});

			// Act
			getSupportedAreas(homeEntity, logger);

			// Assert
			expect(logger.error).toHaveBeenCalledWith('No room map found');
			expect(logger.error).not.toHaveBeenCalledWith('No rooms found');
		});

		it('should log both errors when rooms and roomMap are both empty', () => {
			// Arrange
			const logger = createMockLogger();
			const homeEntity = createHomeEntity([]);

			// Act
			const result = getSupportedAreas(homeEntity, logger);

			// Assert
			expect(logger.error).toHaveBeenCalledWith('No rooms found');
			expect(logger.error).toHaveBeenCalledWith('No room map found');
			expect(result.supportedMaps).toEqual([{ mapId: 0, name: 'Default Map' }]);
		});

		it('should use the name of the room referenced by iot_name_id when iot_name is missing', () => {
			// Arrange
			const logger = createMockLogger();
			const rooms: RoomMapping[] = [
				{ id: 2, iot_name_id: '0', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' },
				{ id: 1, iot_name_id: '2', tag: 0, iot_map_id: 0 },
			];
			const homeEntity = createHomeEntity(rooms);

			// Act
			const result = getSupportedAreas(homeEntity, logger);

			// Assert
			expect(result.supportedAreas[1]?.areaInfo?.locationInfo?.locationName).toBe('Kitchen');
		});

		it('should use a random Unknown Room name when iot_name is missing and no room matches', () => {
			// Arrange
			const logger = createMockLogger();
			const rooms: RoomMapping[] = [{ id: 1, iot_name_id: '999', tag: 0, iot_map_id: 0 }];
			const homeEntity = createHomeEntity(rooms);

			// Act
			const result = getSupportedAreas(homeEntity, logger);

			// Assert
			expect(result.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toBe('Unknown Room 4242');
		});
	});
});
