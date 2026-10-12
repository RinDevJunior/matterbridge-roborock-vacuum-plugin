import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { getOperationalErrorName, getOperationalStateName, getRunModeName } from '../../share/matterStateNames.js';
const UNKNOWN_VALUE = 9999;

describe('matterStateNames gap coverage', () => {
	describe('getRunModeName', () => {
		it('should return the key name when the run mode is known', () => {
			// Act
			const result = getRunModeName(RvcRunMode.ModeTag.Cleaning);

			// Assert
			expect(result).toBe('Cleaning');
		});

		it('should return the numeric value as string when the run mode is unknown', () => {
			// Act
			const result = getRunModeName(UNKNOWN_VALUE);

			// Assert
			expect(result).toBe('9999');
		});
	});

	describe('getOperationalStateName', () => {
		it('should return the key name when the operational state is known', () => {
			// Act
			const result = getOperationalStateName(RvcOperationalState.OperationalState.Docked);

			// Assert
			expect(result).toBe('Docked');
		});

		it('should return the numeric value as string when the operational state is unknown', () => {
			// Act
			const result = getOperationalStateName(UNKNOWN_VALUE);

			// Assert
			expect(result).toBe('9999');
		});
	});

	describe('getOperationalErrorName', () => {
		it('should return the key name when the error state is known', () => {
			// Act
			const result = getOperationalErrorName(RvcOperationalState.ErrorState.NoError);

			// Assert
			expect(result).toBe('NoError');
		});

		it('should return the numeric value as string when the error state is unknown', () => {
			// Act
			const result = getOperationalErrorName(UNKNOWN_VALUE);

			// Assert
			expect(result).toBe('9999');
		});
	});
});
