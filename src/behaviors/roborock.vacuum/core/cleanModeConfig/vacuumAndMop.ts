import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanSequenceType } from '../../enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../enums/index.js';
import { CleanModeSetting } from '../CleanModeSetting.js';
import { CleanModeConfig, CleanModeDisplayLabel, CleanModeLabelInfo } from './types.js';

export const vacuumAndMopModeConfigs: CleanModeConfig[] = [
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Balanced,
			MopWaterFlow.Medium,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.Auto },
		],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopQuick].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopQuick].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Balanced,
			MopWaterFlow.Medium,
			0,
			MopRoute.Fast,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.Quick },
		],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopMax].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopMax].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Max,
			MopWaterFlow.Medium,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.Max },
		],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopMin].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopMin].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Balanced,
			MopWaterFlow.Low,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.Min },
		],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopQuiet].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopQuiet].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Quiet,
			MopWaterFlow.Medium,
			0,
			MopRoute.Standard,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.Quiet },
		],
	},
	{
		label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].label,
		mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode,
		setting: new CleanModeSetting(
			VacuumSuctionPower.Custom,
			MopWaterFlow.Custom,
			0,
			MopRoute.Custom,
			CleanSequenceType.Persist,
		),
		modeTags: [
			{ value: RvcCleanMode.ModeTag.Mop },
			{ value: RvcCleanMode.ModeTag.Vacuum },
			{ value: RvcCleanMode.ModeTag.LowEnergy },
		],
	},
];
