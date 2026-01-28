import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { VacuumSuctionPower, MopWaterFlow, MopRoute } from '../default/default.js';
import { MopRouteSmart } from '../smart/smart.js';
import { CleanModeSetting } from './CleanModeSetting.js';

/**
 * Complete mode configuration including display name, settings, and Matter tags.
 */
export interface ModeConfig {
  mode: number;
  label: string;
  setting: CleanModeSetting;
  modeTags: { value: number }[];
}

/**
 * Base clean mode configurations shared across all device types.
 */
export const baseCleanModeConfigs: ModeConfig[] = [
  {
    mode: 5,
    label: 'Mop & Vacuum: Default',
    setting: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    mode: 6,
    label: 'Mop & Vacuum: Quick',
    setting: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
  },
  {
    mode: 7,
    label: 'Mop & Vacuum: Max',
    setting: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    mode: 8,
    label: 'Mop & Vacuum: Min',
    setting: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Min }],
  },
  {
    mode: 9,
    label: 'Mop & Vacuum: Quiet',
    setting: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
  },
  {
    mode: 10,
    label: 'Mop & Vacuum: Custom',
    setting: { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Custom, distance_off: 0, mopRoute: MopRoute.Custom },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.LowEnergy }],
  },
  {
    mode: 31,
    label: 'Mop: Default',
    setting: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    mode: 32,
    label: 'Mop: Max',
    setting: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.High, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    mode: 33,
    label: 'Mop: Min',
    setting: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
  },
  {
    mode: 34,
    label: 'Mop: Quick',
    setting: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
  },
  {
    mode: 35,
    label: 'Mop: DeepClean',
    setting: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Deep },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
  },
  {
    mode: 66,
    label: 'Vacuum: Default',
    setting: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  {
    mode: 67,
    label: 'Vacuum: Max',
    setting: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
  },
  {
    mode: 68,
    label: 'Vacuum: Quiet',
    setting: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard },
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
  },
  {
    mode: 69,
    label: 'Vacuum: Quick',
    setting: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Fast },
    modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
  },
];

/**
 * Smart device-specific mode configurations.
 */
export const smartCleanModeConfigs: ModeConfig[] = [
  {
    mode: 4,
    label: 'Smart Plan',
    setting: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: MopRouteSmart.Smart },
    modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
  },
  ...baseCleanModeConfigs,
];

/**
 * Helper functions to extract different views of the configuration.
 */
export function getModeDisplayMap(configs: ModeConfig[]): Record<number, string> {
  return Object.fromEntries(configs.map((c) => [c.mode, c.label]));
}

export function getModeSettingsMap(configs: ModeConfig[]): Record<number, CleanModeSetting> {
  return Object.fromEntries(configs.map((c) => [c.mode, c.setting]));
}

export function getModeOptions(configs: ModeConfig[]): RvcCleanMode.ModeOption[] {
  return configs.map((c) => ({
    mode: c.mode,
    label: c.label,
    modeTags: c.modeTags,
  }));
}
