import { randomInt } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENE_AREA_ID_MAX, SCENE_AREA_ID_MIN } from '../../constants/index.js';
import { getSupportedRoutines } from '../../initialData/getSupportedRoutines.js';
import { Scene } from '../../roborockCommunication/models/index.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

vi.mock('node:crypto', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, randomInt: vi.fn() };
});

describe('getSupportedRoutines (gap coverage)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(randomInt).mockImplementation(() => 7777);
	});

	it('should return an empty array when routines is undefined', () => {
		// Arrange
		const log = createMockLogger();

		// Act
		const result = getSupportedRoutines(asType<Scene[]>(undefined), log);

		// Assert
		expect(result).toEqual([]);
		expect(log.debug).toHaveBeenCalledWith('No routine found');
	});

	it('should use a random area id within the scene range when the routine id is undefined', () => {
		// Arrange
		const routine = asPartial<Scene>({ id: undefined, name: 'Morning', enabled: true });

		// Act
		const result = getSupportedRoutines([routine]);

		// Assert
		expect(randomInt).toHaveBeenCalledWith(SCENE_AREA_ID_MIN, SCENE_AREA_ID_MAX);
		expect(result).toHaveLength(1);
		expect(result[0].areaId).toBe(7777);
	});

	it('should derive the area id from the routine id when the routine id is defined', () => {
		// Arrange
		const routine = asPartial<Scene>({ id: 3, name: 'Evening', enabled: true });

		// Act
		const result = getSupportedRoutines([routine]);

		// Assert
		expect(randomInt).not.toHaveBeenCalled();
		expect(result[0].areaId).toBe(SCENE_AREA_ID_MIN + 3);
	});
});
