import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

export enum RunModeDisplayLabel {
  Idle = 'Idle',
  Cleaning = 'Cleaning',
  Mapping = 'Mapping',
}

type RunModeLabel = RunModeDisplayLabel.Idle | RunModeDisplayLabel.Cleaning | RunModeDisplayLabel.Mapping;

interface RunModeLabelInfoStruct {
  label: RunModeLabel;
  mode: number;
}

export const RunModeLabelInfo: Record<RunModeLabel, RunModeLabelInfoStruct> = {
  [RunModeDisplayLabel.Idle]: {
    label: RunModeDisplayLabel.Idle,
    mode: 1,
  },
  [RunModeDisplayLabel.Cleaning]: {
    label: RunModeDisplayLabel.Cleaning,
    mode: 2,
  },
  [RunModeDisplayLabel.Mapping]: {
    label: RunModeDisplayLabel.Mapping,
    mode: 3,
  },
};

export const RunModeConfigs: RvcRunMode.ModeOption[] = [
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

export function getDefaultOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
  return [
    {
      operationalStateId: RvcOperationalState.OperationalState.Stopped,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Running,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Paused,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Error,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.SeekingCharger,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Charging,
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Docked,
    },
  ];
}
