import { RvcRunMode } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { getRunningMode } from '../../initialData/getSupportedRunModes.js';
import { asType } from '../helpers/testUtils.js';

const MAPPING_RUN_MODE = 3;
const UNKNOWN_MODE_TAG = 12345;

describe('getRunningMode gap coverage', () => {
	it('should return null when the mode tag is undefined', () => {
		// Act
		const result = getRunningMode(undefined);

		// Assert
		expect(result).toBeNull();
	});

	it('should return null when the mode tag does not match any base run mode config', () => {
		// Act
		const result = getRunningMode(asType<RvcRunMode.ModeTag>(UNKNOWN_MODE_TAG));

		// Assert
		expect(result).toBeNull();
	});

	it('should return the matching run mode number when the mode tag is Mapping', () => {
		// Act
		const result = getRunningMode(RvcRunMode.ModeTag.Mapping);

		// Assert
		expect(result).toBe(MAPPING_RUN_MODE);
	});
});
