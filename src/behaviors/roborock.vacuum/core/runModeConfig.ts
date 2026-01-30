import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

/**
 * Complete run mode configuration including display name, mode, and Matter tags.
 */
export interface RunModeConfig {
  mode: number;
  label: RunModeLabel;
  modeTags: { value: number }[];
}

export enum RunModeDisplayLabel {
  Idle = 'Idle',
  Cleaning = 'Cleaning',
  Mapping = 'Mapping',
}

export type RunModeLabel = RunModeDisplayLabel.Idle | RunModeDisplayLabel.Cleaning | RunModeDisplayLabel.Mapping;

interface RunModeLabelInfoStruct {
  label: RunModeLabel;
  mode: number;
}

export const RunModeLabelInfo: Record<RunModeLabel, RunModeLabelInfoStruct> = {
  [RunModeDisplayLabel.Idle]: { mode: 1, label: RunModeDisplayLabel.Idle },
  [RunModeDisplayLabel.Cleaning]: { mode: 2, label: RunModeDisplayLabel.Cleaning },
  [RunModeDisplayLabel.Mapping]: { mode: 3, label: RunModeDisplayLabel.Mapping },
};

/**
 * Base run mode configurations.
 */
export const baseRunModeConfigs: RunModeConfig[] = [
  {
    mode: RunModeLabelInfo[RunModeDisplayLabel.Idle].mode,
    label: RunModeLabelInfo[RunModeDisplayLabel.Idle].label,
    modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
  },
  {
    mode: RunModeLabelInfo[RunModeDisplayLabel.Cleaning].mode,
    label: RunModeLabelInfo[RunModeDisplayLabel.Cleaning].label,
    modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
  },
  {
    mode: RunModeLabelInfo[RunModeDisplayLabel.Mapping].mode,
    label: RunModeLabelInfo[RunModeDisplayLabel.Mapping].label,
    modeTags: [{ value: RvcRunMode.ModeTag.Mapping }],
  },
];

/**
 * Helper functions to extract different views of the configuration.
 */
export function getRunModeDisplayMap(configs: RunModeConfig[]): Record<number, string> {
  return Object.fromEntries(configs.map((c) => [c.mode, c.label]));
}

export function getRunModeOptions(configs: RunModeConfig[]): RvcRunMode.ModeOption[] {
  return configs.map((c) => ({
    mode: c.mode,
    label: c.label,
    modeTags: c.modeTags,
  }));
}

export function getDefaultOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
  return [
    { operationalStateId: RvcOperationalState.OperationalState.Stopped },
    { operationalStateId: RvcOperationalState.OperationalState.Running },
    { operationalStateId: RvcOperationalState.OperationalState.Paused },
    { operationalStateId: RvcOperationalState.OperationalState.Error },
    { operationalStateId: RvcOperationalState.OperationalState.SeekingCharger },
    { operationalStateId: RvcOperationalState.OperationalState.Charging },
    { operationalStateId: RvcOperationalState.OperationalState.Docked },
  ];
}
