import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanSequenceType } from '../../enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../enums/index.js';
import { CleanModeSetting } from '../CleanModeSetting.js';
import { CleanModeConfig, CleanModeDisplayLabel, CleanModeLabelInfo } from './types.js';

export const mopOnlyModeConfigs: CleanModeConfig[] = [
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Off,
			MopWaterFlow.Medium,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Off,
			MopWaterFlow.High,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Off,
			MopWaterFlow.Low,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Off,
			MopWaterFlow.Medium,
			0,
			MopRoute.Fast,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.MopDeep].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopDeep].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Off,
			MopWaterFlow.Medium,
			0,
			MopRoute.Deep,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
	},
];
