import { MopWaterFlow, WaterSlideCode } from '../enums/index.js';

export const WATER_SLIDE_SMART_WATER = MopWaterFlow.SmartWater;

const WATER_SLIDE_POSITION_TABLE: readonly (readonly [maxPosition: number, canonicalCode: WaterSlideCode])[] = [
	[3, WaterSlideCode.PureWaterFlowStart],
	[7, WaterSlideCode.PureWaterFlowSmall],
	[12, WaterSlideCode.PureWaterFlowGentle],
	[17, WaterSlideCode.PureWaterFlowMiddle],
	[22, WaterSlideCode.PureWaterFlowLarge],
	[27, WaterSlideCode.PureWaterSuperBegin],
	[30, WaterSlideCode.PureWaterFlowEnd],
];

const STANDARD_FLOW_BY_WATER_SLIDE_CODE: ReadonlyMap<number, MopWaterFlow> = new Map([
	[WaterSlideCode.PureWaterFlowSmall, MopWaterFlow.Low],
	[WaterSlideCode.PureWaterFlowMiddle, MopWaterFlow.Medium],
	[WaterSlideCode.PureWaterSuperBegin, MopWaterFlow.High],
]);

/**
 * Devices with a water slider report `220 + position` (1..30). Positions map to canonical codes by range.
 * Codes 221, 230, 240, 250 and 210 have no standard bucket here and are only normalized, never remapped.
 */
export function normalizeWaterSlideCode(code: number): number | undefined {
	if (code === WATER_SLIDE_SMART_WATER) {
		return WATER_SLIDE_SMART_WATER;
	}

	const position = code - 220;
	if (position < 1 || position > 30) {
		return undefined;
	}

	for (const [maxPosition, canonicalCode] of WATER_SLIDE_POSITION_TABLE) {
		if (position <= maxPosition) {
			return canonicalCode;
		}
	}
	return undefined;
}

/**
 * Only Low/Medium/High are mapped (python-roborock aliases 225/235/245 to LOW/MEDIUM/HIGH by name).
 */
export function waterSlideToStandardFlow(code: number): MopWaterFlow | undefined {
	const normalized = normalizeWaterSlideCode(code);
	return normalized === undefined ? undefined : STANDARD_FLOW_BY_WATER_SLIDE_CODE.get(normalized);
}
