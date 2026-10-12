import { ResourceMonitoring } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import {
	computeFilterChangeIndication,
	computeFilterConditionPercent,
	FILTER_RATED_LIFE_SEC,
} from '../../model/ConsumableStatus.js';

describe('ConsumableStatus', () => {
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
