import { describe, expect, it } from 'vitest';

import { MopRoute, MopWaterFlow, WaterSlideCode } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import * as waterSlideCodeModule from '../../../../behaviors/roborock.vacuum/enums/WaterSlideCode.js';

const numericValues = <T extends Record<string, string | number>>(enumObject: T): number[] =>
	Object.values(enumObject).filter((value): value is number => typeof value === 'number');

describe('enums', () => {
	describe('MopWaterFlow', () => {
		it.each([
			['Off', 200],
			['Low', 201],
			['Medium', 202],
			['High', 203],
			['Custom', 204],
			['Min', 205],
			['Max', 206],
			['CustomizeWithDistanceOff', 207],
			['Extreme', 208],
			['Smart', 209],
			['SmartWater', 210],
		])('should map MopWaterFlow.%s to %i', (name, expected) => {
			expect(MopWaterFlow[name as keyof typeof MopWaterFlow]).toBe(expected);
		});

		it('should resolve new member names via reverse lookup', () => {
			expect(MopWaterFlow['Min']).toBe(205);
			expect(MopWaterFlow['Max']).toBe(206);
			expect(MopWaterFlow['Extreme']).toBe(208);
			expect(MopWaterFlow['SmartWater']).toBe(210);
		});

		it('should return undefined when looking up an unknown name', () => {
			expect(MopWaterFlow['Unknown' as keyof typeof MopWaterFlow]).toBeUndefined();
		});
	});

	describe('MopRoute', () => {
		it.each([
			['Standard', 300],
			['Deep', 301],
			['Custom', 302],
			['DeepPlus', 303],
			['Fast', 304],
			['DeepPlusCn', 305],
			['Smart', 306],
		])('should map MopRoute.%s to %i', (name, expected) => {
			expect(MopRoute[name as keyof typeof MopRoute]).toBe(expected);
		});

		it('should resolve DeepPlusCn by name', () => {
			expect(MopRoute['DeepPlusCn']).toBe(305);
		});

		it('should return undefined when looking up an unknown name', () => {
			expect(MopRoute['Unknown' as keyof typeof MopRoute]).toBeUndefined();
		});
	});

	describe('WaterSlideCode', () => {
		it.each([
			['PureWaterFlowStart', 221],
			['PureWaterFlowSmall', 225],
			['PureWaterFlowGentle', 230],
			['PureWaterFlowMiddle', 235],
			['PureWaterFlowLarge', 240],
			['PureWaterSuperBegin', 245],
			['PureWaterFlowEnd', 250],
		])('should map WaterSlideCode.%s to %i', (name, expected) => {
			expect(WaterSlideCode[name as keyof typeof WaterSlideCode]).toBe(expected);
		});

		it('should contain exactly the seven canonical slide codes', () => {
			expect(numericValues(WaterSlideCode).sort((a, b) => a - b)).toEqual([221, 225, 230, 235, 240, 245, 250]);
		});
	});

	describe('index re-export', () => {
		it('should re-export WaterSlideCode from the enums barrel as the same object', () => {
			expect(WaterSlideCode).toBe(waterSlideCodeModule.WaterSlideCode);
		});
	});
});
