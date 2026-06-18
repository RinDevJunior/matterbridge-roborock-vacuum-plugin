import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanSequenceType } from '../../enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../enums/index.js';
import { CleanModeSetting } from '../CleanModeSetting.js';
import { CleanModeConfig, CleanModeDisplayLabel, CleanModeLabelInfo } from './types.js';

/**
 * Smart Plan mode configuration.
 * Exported for use in deviceCapabilityRegistry.ts.
 */
export const smartPlanModeConfig: CleanModeConfig = {
	label: CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].label,
	mode: CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode,
	setting: new CleanModeSetting(0, 0, 0, MopRoute.Smart, CleanSequenceType.Persist),
	modeTags: [
		{ value: RvcCleanMode.ModeTag.Mop },
		{ value: RvcCleanMode.ModeTag.Vacuum },
		{ value: RvcCleanMode.ModeTag.Auto },
	],
};

/**
 * Vacuum Followed by Mop mode configuration.
 * Exported for use in deviceCapabilityRegistry.ts.
 */
export const vacFollowedByMopModeConfig: CleanModeConfig = {
	label: CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].label,
	mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode,
	setting: new CleanModeSetting(
		VacuumSuctionPower.Balanced,
		MopWaterFlow.Low,
		0,
		MopRoute.Standard,
		CleanSequenceType.OneTime,
	),
	modeTags: [
		{ value: RvcCleanMode.ModeTag.Mop },
		{ value: RvcCleanMode.ModeTag.Vacuum },
		{ value: RvcCleanMode.ModeTag.VacuumThenMop },
	],
};

export const vacAndMopDeepModeConfig: CleanModeConfig = {
	label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDeep].label,
	mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDeep].mode,
	setting: new CleanModeSetting(
		VacuumSuctionPower.Balanced,
		MopWaterFlow.Medium,
		0,
		MopRoute.Deep,
		CleanSequenceType.Persist,
	),
	modeTags: [
		{ value: RvcCleanMode.ModeTag.Mop },
		{ value: RvcCleanMode.ModeTag.Vacuum },
		{ value: RvcCleanMode.ModeTag.DeepClean },
	],
};
