import { RvcCleanMode, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

export function getDefaultSupportedRunModes(): RvcRunMode.ModeOption[] {
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

export function getDefaultSupportedCleanModes(): RvcCleanMode.ModeOption[] {
  return [
    {
      label: 'Vacuum',
      mode: 4,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
    },
    {
      label: 'Mop',
      mode: 5,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }],
    },
  ];
}

export function getDefaultOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
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
      operationalStateId: RvcOperationalState.OperationalState.Docked,
      operationalStateLabel: 'Docked',
    },
  ];
}
