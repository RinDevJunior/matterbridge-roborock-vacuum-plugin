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

// prettier-ignore
export enum CleanModeDisplayLabel {
  SmartPlan =                     'Smart Plan',

  VacuumAndMopDefault =           'Vacuum & Mop: Default',
  VacuumAndMopQuick =             'Vacuum & Mop: Quick',
  VacuumAndMopMax =               'Vacuum & Mop: Max',
  VacuumAndMopMin =               'Vacuum & Mop: Min',
  VacuumAndMopQuiet =             'Vacuum & Mop: Quiet',
  VacuumAndMopEnergySaving =      'Vacuum & Mop: Energy Saving',
  VacFollowedByMop =              'Vacuum & Mop: Vac Follow by Mop',
  VacuumAndMopDeep =              'Vacuum & Mop: Deep',

  MopDefault =                    'Mop: Default',
  MopMax =                        'Mop: Max',
  MopMin =                        'Mop: Min',
  MopQuick =                      'Mop: Quick',
  MopDeep =                       'Mop: Deep',

  VacuumDefault =                 'Vacuum: Default',
  VacuumMin =                     'Vacuum: Min',
  VacuumMax =                     'Vacuum: Max',
  VacuumQuiet =                   'Vacuum: Quiet',
  VacuumQuick =                   'Vacuum: Quick',
  GoVacation =                    'Go Vacation',
}

export type CleanModeLabel =
  | CleanModeDisplayLabel.SmartPlan
  | CleanModeDisplayLabel.VacuumAndMopDefault
  | CleanModeDisplayLabel.VacuumAndMopQuick
  | CleanModeDisplayLabel.VacuumAndMopMax
  | CleanModeDisplayLabel.VacuumAndMopMin
  | CleanModeDisplayLabel.VacuumAndMopQuiet
  | CleanModeDisplayLabel.VacuumAndMopEnergySaving
  | CleanModeDisplayLabel.VacuumAndMopDeep
  | CleanModeDisplayLabel.MopDefault
  | CleanModeDisplayLabel.MopMax
  | CleanModeDisplayLabel.MopMin
  | CleanModeDisplayLabel.MopQuick
  | CleanModeDisplayLabel.MopDeep
  | CleanModeDisplayLabel.VacuumDefault
  | CleanModeDisplayLabel.VacuumMax
  | CleanModeDisplayLabel.VacuumQuiet
  | CleanModeDisplayLabel.VacuumQuick
  | CleanModeDisplayLabel.GoVacation
  | CleanModeDisplayLabel.VacFollowedByMop;

interface CleanModeLabelInfoStruct {
  label: CleanModeLabel;
  mode: number;
}

// prettier-ignore
export const CleanModeLabelInfo: Record<CleanModeLabel, CleanModeLabelInfoStruct> = {
  [CleanModeDisplayLabel.SmartPlan]:                      { mode: 4, label: CleanModeDisplayLabel.SmartPlan },
  [CleanModeDisplayLabel.VacuumAndMopDefault]:            { mode: 5, label: CleanModeDisplayLabel.VacuumAndMopDefault },
  [CleanModeDisplayLabel.VacuumAndMopQuick]:              { mode: 6, label: CleanModeDisplayLabel.VacuumAndMopQuick },
  [CleanModeDisplayLabel.VacuumAndMopMax]:                { mode: 7, label: CleanModeDisplayLabel.VacuumAndMopMax },
  [CleanModeDisplayLabel.VacuumAndMopMin]:                { mode: 8, label: CleanModeDisplayLabel.VacuumAndMopMin },
  [CleanModeDisplayLabel.VacuumAndMopQuiet]:              { mode: 9, label: CleanModeDisplayLabel.VacuumAndMopQuiet },
  [CleanModeDisplayLabel.VacuumAndMopEnergySaving]:       { mode: 10, label: CleanModeDisplayLabel.VacuumAndMopEnergySaving },
  [CleanModeDisplayLabel.VacFollowedByMop]:               { mode: 11, label: CleanModeDisplayLabel.VacFollowedByMop },
  [CleanModeDisplayLabel.VacuumAndMopDeep]:               { mode: 12, label: CleanModeDisplayLabel.VacuumAndMopDeep },
  [CleanModeDisplayLabel.MopDefault]:                     { mode: 31, label: CleanModeDisplayLabel.MopDefault },
  [CleanModeDisplayLabel.MopMax]:                         { mode: 32, label: CleanModeDisplayLabel.MopMax },
  [CleanModeDisplayLabel.MopMin]:                         { mode: 33, label: CleanModeDisplayLabel.MopMin },
  [CleanModeDisplayLabel.MopQuick]:                       { mode: 34, label: CleanModeDisplayLabel.MopQuick },
  [CleanModeDisplayLabel.MopDeep]:                        { mode: 35, label: CleanModeDisplayLabel.MopDeep },
  [CleanModeDisplayLabel.VacuumDefault]:                  { mode: 66, label: CleanModeDisplayLabel.VacuumDefault },
  [CleanModeDisplayLabel.VacuumMax]:                      { mode: 67, label: CleanModeDisplayLabel.VacuumMax },
  [CleanModeDisplayLabel.VacuumQuiet]:                    { mode: 68, label: CleanModeDisplayLabel.VacuumQuiet },
  [CleanModeDisplayLabel.VacuumQuick]:                    { mode: 69, label: CleanModeDisplayLabel.VacuumQuick },
  [CleanModeDisplayLabel.GoVacation]:                     { mode: 99, label: CleanModeDisplayLabel.GoVacation },
};

/**
 * Base clean mode configurations shared across all device types.
 */
export const baseCleanModeConfigs: CleanModeConfig[] = [
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

/**
 * Smart device-specific mode configurations.
 * @deprecated Use deviceCapabilityRegistry.ts to manage per-device modes.
 */
export const smartCleanModeConfigs: CleanModeConfig[] = [
  smartPlanModeConfig,
  vacFollowedByMopModeConfig,
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
