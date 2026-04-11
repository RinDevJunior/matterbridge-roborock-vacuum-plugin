import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanSequenceType } from '../../enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../enums/index.js';
import { CleanModeSetting } from '../CleanModeSetting.js';
import { CleanModeConfig, CleanModeDisplayLabel, CleanModeLabelInfo } from './types.js';

export const vacuumOnlyModeConfigs: CleanModeConfig[] = [
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Balanced,
			MopWaterFlow.Off,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Max,
			MopWaterFlow.Off,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Quiet,
			MopWaterFlow.Off,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Balanced,
			MopWaterFlow.Off,
			0,
			MopRoute.Fast,
			CleanSequenceType.Persist,
		),
		modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
	},
];
