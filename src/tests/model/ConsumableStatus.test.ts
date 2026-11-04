import { ResourceMonitoring } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import {
	computeFilterChangeIndication,
	computeFilterConditionPercent,
	FILTER_RATED_LIFE_SEC,
	resolveFilterConditionPercent,
} from '../../model/ConsumableStatus.js';

describe('ConsumableStatus', () => {
	describe('resolveFilterConditionPercent', () => {
		it('should return the V1 elapsed-seconds percent when only filterWorkTimeSec is present', () => {
			// Arrange
			const status = { filterWorkTimeSec: 270000 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(50);
			expect(result).toBe(computeFilterConditionPercent(270000));
		});

		it('should return 0 when V1 filterWorkTimeSec equals the rated life', () => {
			// Arrange
			const status = { filterWorkTimeSec: FILTER_RATED_LIFE_SEC };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(0);
		});

		it('should return 100 when the status has neither field set', () => {
			// Arrange
			const status = {};

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(100);
		});

		it('should return 100 when both fields are explicitly undefined', () => {
			// Arrange
			const status = { filterWorkTimeSec: undefined, filterConditionPercent: undefined };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(100);
		});

		it('should return the Q10 filterConditionPercent directly when it is in range', () => {
			// Arrange
			const status = { filterConditionPercent: 42 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(42);
		});

		it('should round a non-integer Q10 filterConditionPercent to the nearest integer', () => {
			// Arrange
			const status = { filterConditionPercent: 67.6 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(68);
		});

		it('should clamp a Q10 filterConditionPercent above 100 down to 100', () => {
			// Arrange
			const status = { filterConditionPercent: 150 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(100);
		});

		it('should clamp a negative Q10 filterConditionPercent up to 0', () => {
			// Arrange
			const status = { filterConditionPercent: -10 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(0);
		});

		it('should prefer filterConditionPercent over filterWorkTimeSec when both are present', () => {
			// Arrange
			const status = { filterWorkTimeSec: 540000, filterConditionPercent: 80 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(80);
		});

		it('should treat filterConditionPercent of 0 as a real value rather than falling back to seconds', () => {
			// Arrange
			const status = { filterWorkTimeSec: 0, filterConditionPercent: 0 };

			// Act
			const result = resolveFilterConditionPercent(status);

			// Assert
			expect(result).toBe(0);
		});
	});

	describe('computeFilterConditionPercent', () => {
		it('should return 100 for fresh filter (filterWorkTimeSec: 0)', () => {
			const result = computeFilterConditionPercent(0);
			expect(result).toBe(100);
		});

		it('should return 0 for fully worn filter (filterWorkTimeSec: 540000)', () => {
			const result = computeFilterConditionPercent(FILTER_RATED_LIFE_SEC);
			expect(result).toBe(0);
		});

		it('should return 50 for mid-life filter (filterWorkTimeSec: 270000)', () => {
			const result = computeFilterConditionPercent(270000);
			expect(result).toBe(50);
		});

		it('should clamp to 0 when filterWorkTimeSec exceeds rated life', () => {
			const result = computeFilterConditionPercent(600000);
			expect(result).toBe(0);
		});

		it('should round correctly for value resulting in decimal', () => {
			const result = computeFilterConditionPercent(1);
			expect(result).toBe(100);
		});

		it('should clamp to 100 when result would be over 100', () => {
			const result = computeFilterConditionPercent(-1000);
			expect(result).toBe(100);
		});
	});

	describe('computeFilterChangeIndication', () => {
		it('should return Critical when conditionPercent is exactly 5', () => {
			const result = computeFilterChangeIndication(5);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Critical);
		});

		it('should return Critical when conditionPercent is 0', () => {
			const result = computeFilterChangeIndication(0);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Critical);
		});

		it('should return Warning when conditionPercent is exactly 15', () => {
			const result = computeFilterChangeIndication(15);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Warning);
		});

		it('should return Warning when conditionPercent is 6', () => {
			const result = computeFilterChangeIndication(6);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Warning);
		});

		it('should return Ok when conditionPercent is 16', () => {
			const result = computeFilterChangeIndication(16);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Ok);
		});

		it('should return Ok when conditionPercent is 100', () => {
			const result = computeFilterChangeIndication(100);
			expect(result).toBe(ResourceMonitoring.ChangeIndication.Ok);
		});
	});
});
