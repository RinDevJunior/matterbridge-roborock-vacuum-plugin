import { RvcCleanMode, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

export function getSupportedRunModesA27(): RvcRunMode.ModeOption[] {
  return [
    {
      label: 'Idle',
      mode: 1,
      modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
    },
    {
      label: 'Cleaning',
      mode: 2,
      modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
    },
    {
      label: 'Mapping',
      mode: 3,
      modeTags: [{ value: RvcRunMode.ModeTag.Mapping }],
    },
  ];
}

export function getSupportedCleanModesA27(): RvcCleanMode.ModeOption[] {
  return [
    {
      label: 'Mop',
      mode: 5,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: 'Vacuum',
      mode: 6,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: 'Mop & Vacuum',
      mode: 7,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.DeepClean }],
    },

    {
      label: 'Custom',
      mode: 8,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
  ];
}

export function getOperationalStatesA27(): RvcOperationalState.OperationalStateStruct[] {
  return [
    {
      operationalStateId: RvcOperationalState.OperationalState.Stopped,
      operationalStateLabel: 'Stopped',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Running,
      operationalStateLabel: 'Running',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Paused,
      operationalStateLabel: 'Paused',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Error,
      operationalStateLabel: 'Error',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.SeekingCharger,
      operationalStateLabel: 'SeekingCharger',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Charging,
      operationalStateLabel: 'Charging',
    },
    {
      operationalStateId: RvcOperationalState.OperationalState.Docked,
      operationalStateLabel: 'Docked',
    },
  ];
}
