import { describe, expect, it } from 'vitest';

import {
	normalizeWaterSlideCode,
	WATER_SLIDE_SMART_WATER,
	waterSlideToStandardFlow,
} from '../../../../behaviors/roborock.vacuum/core/waterSlide.js';
import { MopWaterFlow } from '../../../../behaviors/roborock.vacuum/enums/index.js';

describe('waterSlide', () => {
	describe('WATER_SLIDE_SMART_WATER', () => {
		it('should equal 210', () => {
			expect(WATER_SLIDE_SMART_WATER).toBe(210);
		});

		it('should equal MopWaterFlow.SmartWater', () => {
			expect(WATER_SLIDE_SMART_WATER).toBe(MopWaterFlow.SmartWater);
		});
	});

	describe('normalizeWaterSlideCode', () => {
		it.each([
			[221, 221],
			[222, 221],
			[223, 221],
			[224, 225],
			[225, 225],
			[226, 225],
			[227, 225],
			[228, 230],
			[232, 230],
			[233, 235],
			[237, 235],
			[238, 240],
			[242, 240],
			[243, 245],
			[247, 245],
			[248, 250],
			[250, 250],
			[210, 210],
		])('should normalize code %i to %i', (input, expected) => {
			expect(normalizeWaterSlideCode(input)).toBe(expected);
		});

		it.each([200, 201, 202, 203, 209, 211, 220, 251, 252, 0, -1])(
			'should return undefined for non-slide code %i',
			(input) => {
				expect(normalizeWaterSlideCode(input)).toBeUndefined();
			},
		);

		it('should return undefined for NaN input', () => {
			expect(normalizeWaterSlideCode(Number.NaN)).toBeUndefined();
		});
	});

	describe('waterSlideToStandardFlow', () => {
		it.each([
			[224, MopWaterFlow.Low],
			[225, MopWaterFlow.Low],
			[227, MopWaterFlow.Low],
			[235, MopWaterFlow.Medium],
			[233, MopWaterFlow.Medium],
			[245, MopWaterFlow.High],
			[247, MopWaterFlow.High],
		])('should map slide code %i to standard flow %i', (input, expected) => {
			expect(waterSlideToStandardFlow(input)).toBe(expected);
		});

		it.each([221, 230, 240, 250, 210])('should return undefined for unmapped slide code %i', (input) => {
			expect(waterSlideToStandardFlow(input)).toBeUndefined();
		});

		it.each([200, 201, 202, 203, 209, 0, -1, 999])('should return undefined for non-slide code %i', (input) => {
			expect(waterSlideToStandardFlow(input)).toBeUndefined();
		});
	});
});
