import { describe, expect, it } from 'vitest';

import { computeEstimatedEndTimeFromCleanProgress, MIN_CLEAN_PERCENT } from '../../share/estimatedEndTime.js';

describe('computeEstimatedEndTimeFromCleanProgress', () => {
	const fixedNow = 1_700_000_000;
	const currentArea = 1;

	it('should return null when currentArea is null', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, 25, null, fixedNow)).toBeNull();
	});

	it('should return null when cleanPercent is undefined', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, undefined, currentArea, fixedNow)).toBeNull();
	});

	it('should return null when cleanPercent is 0', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, 0, currentArea, fixedNow)).toBeNull();
	});

	it(`should return null when cleanPercent is below MIN_CLEAN_PERCENT (${MIN_CLEAN_PERCENT})`, () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, 4, currentArea, fixedNow)).toBeNull();
	});

	it('should return null when cleanPercent is greater than 100', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, 101, currentArea, fixedNow)).toBeNull();
	});

	it('should return null when cleanTimeSeconds is 0 or negative', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(0, 25, currentArea, fixedNow)).toBeNull();
		expect(computeEstimatedEndTimeFromCleanProgress(-10, 25, currentArea, fixedNow)).toBeNull();
	});

	it('should return now plus remaining seconds when inputs are valid', () => {
		const result = computeEstimatedEndTimeFromCleanProgress(60, 25, currentArea, fixedNow);
		expect(result).toBe(fixedNow + 180);
	});

	it('should return nowEpochSeconds when cleanPercent is 100 and cleanTimeSeconds is positive', () => {
		expect(computeEstimatedEndTimeFromCleanProgress(60, 100, currentArea, fixedNow)).toBe(fixedNow);
	});

	it('should use injected nowEpochSeconds for determinism', () => {
		const customNow = 1_600_000_000;
		const result = computeEstimatedEndTimeFromCleanProgress(120, 50, currentArea, customNow);
		expect(result).toBe(customNow + 120);
	});
});
