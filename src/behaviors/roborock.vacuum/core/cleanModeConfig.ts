import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { CleanModeSetting } from './CleanModeSetting.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';
import { CleanSequenceType } from '../enums/CleanSequenceType.js';

/**
 * Complete mode configuration including display name, settings, and Matter tags.
 */
export interface CleanModeConfig {
  mode: number;
  label: string;
  setting: CleanModeSetting;
  modeTags: { value: number }[];
}

export enum CleanModeDisplayLabel {
  SmartPlan = 'Smart Plan',

  MopAndVacuumDefault = 'Mop & Vacuum: Default',
  MopAndVacuumQuick = 'Mop & Vacuum: Quick',
  MopAndVacuumMax = 'Mop & Vacuum: Max',
  MopAndVacuumMin = 'Mop & Vacuum: Min',
  MopAndVacuumQuiet = 'Mop & Vacuum: Quiet',
  MopAndVacuumEnergySaving = 'Mop & Vacuum: Energy Saving',
  MopAndVaccum_VacFollowedByMop = 'Mop & Vacuum: Vac Follow by Mop',

  MopDefault = 'Mop: Default',
  MopMax = 'Mop: Max',
  MopMin = 'Mop: Min',
  MopQuick = 'Mop: Quick',
  MopDeepClean = 'Mop: DeepClean',

  VacuumDefault = 'Vacuum: Default',
  VacuumMin = 'Vacuum: Min',
  VacuumMax = 'Vacuum: Max',
  VacuumQuiet = 'Vacuum: Quiet',
  VacuumQuick = 'Vacuum: Quick',
  GoVacation = 'Go Vacation',
}

export type CleanModeLabel =
  | CleanModeDisplayLabel.SmartPlan
  | CleanModeDisplayLabel.MopAndVacuumDefault
  | CleanModeDisplayLabel.MopAndVacuumQuick
  | CleanModeDisplayLabel.MopAndVacuumMax
  | CleanModeDisplayLabel.MopAndVacuumMin
  | CleanModeDisplayLabel.MopAndVacuumQuiet
  | CleanModeDisplayLabel.MopAndVacuumEnergySaving
  | CleanModeDisplayLabel.MopDefault
  | CleanModeDisplayLabel.MopMax
  | CleanModeDisplayLabel.MopMin
  | CleanModeDisplayLabel.MopQuick
  | CleanModeDisplayLabel.MopDeepClean
  | CleanModeDisplayLabel.VacuumDefault
  | CleanModeDisplayLabel.VacuumMax
  | CleanModeDisplayLabel.VacuumQuiet
  | CleanModeDisplayLabel.VacuumQuick
  | CleanModeDisplayLabel.GoVacation
  | CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop;

interface CleanModeLabelInfoStruct {
  label: CleanModeLabel;
  mode: number;
}

export const CleanModeLabelInfo: Record<CleanModeLabel, CleanModeLabelInfoStruct> = {
  [CleanModeDisplayLabel.SmartPlan]: { mode: 4, label: CleanModeDisplayLabel.SmartPlan },
  [CleanModeDisplayLabel.MopAndVacuumDefault]: { mode: 5, label: CleanModeDisplayLabel.MopAndVacuumDefault },
  [CleanModeDisplayLabel.MopAndVacuumQuick]: { mode: 6, label: CleanModeDisplayLabel.MopAndVacuumQuick },
  [CleanModeDisplayLabel.MopAndVacuumMax]: { mode: 7, label: CleanModeDisplayLabel.MopAndVacuumMax },
  [CleanModeDisplayLabel.MopAndVacuumMin]: { mode: 8, label: CleanModeDisplayLabel.MopAndVacuumMin },
  [CleanModeDisplayLabel.MopAndVacuumQuiet]: { mode: 9, label: CleanModeDisplayLabel.MopAndVacuumQuiet },
  [CleanModeDisplayLabel.MopAndVacuumEnergySaving]: { mode: 10, label: CleanModeDisplayLabel.MopAndVacuumEnergySaving },
  [CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop]: { mode: 11, label: CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop },
  [CleanModeDisplayLabel.MopDefault]: { mode: 31, label: CleanModeDisplayLabel.MopDefault },
  [CleanModeDisplayLabel.MopMax]: { mode: 32, label: CleanModeDisplayLabel.MopMax },
  [CleanModeDisplayLabel.MopMin]: { mode: 33, label: CleanModeDisplayLabel.MopMin },
  [CleanModeDisplayLabel.MopQuick]: { mode: 34, label: CleanModeDisplayLabel.MopQuick },
  [CleanModeDisplayLabel.MopDeepClean]: { mode: 35, label: CleanModeDisplayLabel.MopDeepClean },
  [CleanModeDisplayLabel.VacuumDefault]: { mode: 66, label: CleanModeDisplayLabel.VacuumDefault },
  [CleanModeDisplayLabel.VacuumMax]: { mode: 67, label: CleanModeDisplayLabel.VacuumMax },
  [CleanModeDisplayLabel.VacuumQuiet]: { mode: 68, label: CleanModeDisplayLabel.VacuumQuiet },
  [CleanModeDisplayLabel.VacuumQuick]: { mode: 69, label: CleanModeDisplayLabel.VacuumQuick },
  [CleanModeDisplayLabel.GoVacation]: { mode: 99, label: CleanModeDisplayLabel.GoVacation },
};

/**
 * Base clean mode configurations shared across all device types.
 */
export const baseCleanModeConfigs: CleanModeConfig[] = [
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuick].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuick].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Fast, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMax].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMax].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Max, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMin].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMin].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Low, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Min }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuiet].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuiet].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Quiet, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.LowEnergy }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Low, 0, MopRoute.Standard, CleanSequenceType.OneTime),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.VacuumThenMop }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.High, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Low, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Fast, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.MopDeepClean].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.MopDeepClean].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Deep, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Max, MopWaterFlow.Off, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Quiet, MopWaterFlow.Off, 0, MopRoute.Standard, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
  },
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].mode,
    setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Fast, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
  },
];

/**
 * Smart device-specific mode configurations.
 */
export const smartCleanModeConfigs: CleanModeConfig[] = [
  {
    label: CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].label,
    mode: CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode,
    setting: new CleanModeSetting(0, 0, 0, MopRoute.Smart, CleanSequenceType.Persist),
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  ...baseCleanModeConfigs,
];

/**
 * Helper functions to extract different views of the configuration.
 */
export function getModeDisplayMap(configs: CleanModeConfig[]): Record<number, string> {
  return Object.fromEntries(configs.map((c) => [c.mode, c.label]));
}

export function getModeSettingsMap(configs: CleanModeConfig[]): Record<number, CleanModeSetting> {
  return Object.fromEntries(configs.map((c) => [c.mode, c.setting]));
}

export function getModeOptions(configs: CleanModeConfig[]): RvcCleanMode.ModeOption[] {
  return configs.map((c) => ({
    mode: c.mode,
    label: c.label,
    modeTags: c.modeTags,
  }));
}
