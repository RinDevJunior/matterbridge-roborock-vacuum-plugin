import { describe, expect, it, vi } from 'vitest';

import { getSupportedRoutines } from '../../initialData/getSupportedRoutines.js';
import { asPartial } from '../helpers/testUtils.js';
import { makeLogger } from '../testUtils.js';

describe('getSupportedRoutines', () => {
	it('returns empty array and logs debug when routine missing', () => {
		const mockLogger = makeLogger();
		const result = getSupportedRoutines([], mockLogger);
		expect(result).toEqual([]);
		expect(mockLogger.debug).toHaveBeenCalledWith('No routine found');
	});

	it('maps enabled routine to ServiceArea.Area entries', () => {
		const mockLogger = makeLogger();
		const routines = [
			asPartial({ id: 10, name: 'Routine A', enabled: true, param: '', type: 'auto' }),
			asPartial({ id: 0, name: 'Routine B', enabled: false, param: '', type: 'auto' }),
		];
		const result = getSupportedRoutines(routines, mockLogger);
		expect(result.length).toBe(1);
		expect(result[0]?.areaId).toBe(5010); // 5000 + 10
		expect(result[0]?.areaInfo?.locationInfo?.locationName).toBe('Routine A');
	});
});
