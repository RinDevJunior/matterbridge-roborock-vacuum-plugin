import { describe, expect, it } from 'vitest';

import { CleanModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { getSettingFromCleanMode } from '../../../../behaviors/roborock.vacuum/core/cleanModeUtils.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import type { CleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';
import { asPartial } from '../../../helpers/testUtils.js';

// distance_off = 210 - 5 * distanceOff; DISTANCE_OFF_DEFAULT = 25 -> 85
const DISTANCE_OFF_FROM_DEFAULT = 85;

describe('cleanModeUtils gap coverage', () => {
	describe('getSettingFromCleanMode fallback arms', () => {
		it('should fall back to Medium water flow and Standard route when mop names are unknown', () => {
			const settings = asPartial<CleanModeSettings>({
				mopping: asPartial<CleanModeSettings['mopping']>({ waterFlowMode: 'Nope', mopRouteMode: 'Nope' }),
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);

			expect(result?.waterFlow).toBe(MopWaterFlow.Medium);
			expect(result?.mopRoute).toBe(MopRoute.Standard);
			expect(result?.distance_off).toBe(0);
			expect(result?.suctionPower).toBe(VacuumSuctionPower.Off);
		});

		it('should use the default distance_off when CustomizeWithDistanceOff has no distanceOff value', () => {
			const settings = asPartial<CleanModeSettings>({
				mopping: asPartial<CleanModeSettings['mopping']>({
					waterFlowMode: 'CustomizeWithDistanceOff',
					mopRouteMode: 'Standard',
				}),
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);

			expect(result?.waterFlow).toBe(MopWaterFlow.CustomizeWithDistanceOff);
			expect(result?.distance_off).toBe(DISTANCE_OFF_FROM_DEFAULT);
		});

		it('should compute distance_off from the configured distanceOff value when provided', () => {
			const settings = asPartial<CleanModeSettings>({
				mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Standard', distanceOff: 10 },
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);

			expect(result?.distance_off).toBe(160);
		});

		it('should fall back to Balanced suction and Standard route when vacuum names are unknown', () => {
			const settings = asPartial<CleanModeSettings>({
				vacuuming: asPartial<CleanModeSettings['vacuuming']>({ fanMode: 'Nope', mopRouteMode: 'Nope' }),
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.VacuumDefault, settings);

			expect(result?.suctionPower).toBe(VacuumSuctionPower.Balanced);
			expect(result?.waterFlow).toBe(MopWaterFlow.Off);
			expect(result?.mopRoute).toBe(MopRoute.Standard);
			expect(result?.distance_off).toBe(0);
		});

		it('should fall back to Balanced suction, Medium water flow and Standard route when vacmop names are unknown', () => {
			const settings = asPartial<CleanModeSettings>({
				vacmop: asPartial<CleanModeSettings['vacmop']>({
					fanMode: 'Nope',
					waterFlowMode: 'Nope',
					mopRouteMode: 'Nope',
				}),
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.VacuumAndMopDefault, settings);

			expect(result?.suctionPower).toBe(VacuumSuctionPower.Balanced);
			expect(result?.waterFlow).toBe(MopWaterFlow.Medium);
			expect(result?.mopRoute).toBe(MopRoute.Standard);
			expect(result?.distance_off).toBe(0);
		});

		it('should use the default distance_off when vacmop CustomizeWithDistanceOff has no distanceOff value', () => {
			const settings = asPartial<CleanModeSettings>({
				vacmop: asPartial<CleanModeSettings['vacmop']>({
					fanMode: 'Balanced',
					waterFlowMode: 'CustomizeWithDistanceOff',
					mopRouteMode: 'Standard',
				}),
			});

			const result = getSettingFromCleanMode(CleanModeDisplayLabel.VacuumAndMopDefault, settings);

			expect(result?.distance_off).toBe(DISTANCE_OFF_FROM_DEFAULT);
		});

		it.each([
			{ label: CleanModeDisplayLabel.MopDefault, suction: VacuumSuctionPower.Off, water: MopWaterFlow.Medium },
			{
				label: CleanModeDisplayLabel.VacuumDefault,
				suction: VacuumSuctionPower.Balanced,
				water: MopWaterFlow.Off,
			},
			{
				label: CleanModeDisplayLabel.VacuumAndMopDefault,
				suction: VacuumSuctionPower.Balanced,
				water: MopWaterFlow.Medium,
			},
		])('should use built-in defaults for $label when its settings section is missing', ({ label, suction, water }) => {
			const result = getSettingFromCleanMode(label, asPartial<CleanModeSettings>({}));

			expect(result?.suctionPower).toBe(suction);
			expect(result?.waterFlow).toBe(water);
			expect(result?.mopRoute).toBe(MopRoute.Standard);
			expect(result?.sequenceType).toBe(CleanSequenceType.Persist);
		});
	});
});
