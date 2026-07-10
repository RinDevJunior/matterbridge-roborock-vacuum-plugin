import { describe, expect, it } from 'vitest';

import {
	computeAreaEstimatedTime,
	computeEstimatedEndTimeFromCleanProgress,
	MIN_CLEAN_PERCENT,
} from '../../share/estimatedEndTime.js';

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

describe('computeAreaEstimatedTime', () => {
	it('should return 180 when cleanPercent=25 and cleanTimeSeconds=60', () => {
		const result = computeAreaEstimatedTime(60, 25);
		expect(result).toBe(180);
	});

	it('should return 0 when cleanPercent=100', () => {
		const result = computeAreaEstimatedTime(60, 100);
		expect(result).toBe(0);
	});

	it('should return null when cleanPercent is undefined', () => {
		const result = computeAreaEstimatedTime(60, undefined);
		expect(result).toBeNull();
	});

	it('should return null when cleanPercent is 0 or below', () => {
		expect(computeAreaEstimatedTime(60, 0)).toBeNull();
		expect(computeAreaEstimatedTime(60, -5)).toBeNull();
	});

	it(`should return null when cleanPercent is below MIN_CLEAN_PERCENT (${MIN_CLEAN_PERCENT})`, () => {
		expect(computeAreaEstimatedTime(60, 4)).toBeNull();
	});

	it('should return null when cleanPercent is greater than 100', () => {
		const result = computeAreaEstimatedTime(60, 101);
		expect(result).toBeNull();
	});

	it('should return null when cleanTimeSeconds is 0', () => {
		const result = computeAreaEstimatedTime(0, 25);
		expect(result).toBeNull();
	});

	it('should return null when cleanTimeSeconds is negative', () => {
		const result = computeAreaEstimatedTime(-10, 25);
		expect(result).toBeNull();
	});

	it('should return raw remaining seconds (duration, not epoch timestamp)', () => {
		// This confirms it returns remaining seconds, not now+remaining
		const result = computeAreaEstimatedTime(120, 50);
		expect(result).toBe(120); // 120 * (100-50) / 50 = 120
	});

	it('should round the remaining seconds calculation', () => {
		// 100 * (100-33) / 33 = 100 * 67 / 33 = 202.727... → 203
		const result = computeAreaEstimatedTime(100, 33);
		expect(result).toBe(203);
	});

	it('should handle minimum valid cleanPercent value', () => {
		// MIN_CLEAN_PERCENT = 5
		const result = computeAreaEstimatedTime(100, 5);
		expect(result).toBe(1900); // 100 * (100-5) / 5 = 1900
	});

	it('should handle very high cleanPercent near 100', () => {
		// 60 * (100-99) / 99 = 60 / 99 = 0.606... → 1
		const result = computeAreaEstimatedTime(60, 99);
		expect(result).toBe(1);
	});
});
