import { RvcCleanMode, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { RvcCleanMode as RvcCleanModeDisplayMap } from './smart.js';

export function getSupportedRunModesSmart(): RvcRunMode.ModeOption[] {
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

export function getSupportedCleanModesSmart(): RvcCleanMode.ModeOption[] {
  return [
    {
      label: RvcCleanModeDisplayMap[4],
      mode: 4,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: RvcCleanModeDisplayMap[5],
      mode: 5,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Day }],
    },
    {
      label: RvcCleanModeDisplayMap[6],
      mode: 6,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
    {
      label: RvcCleanModeDisplayMap[7],
      mode: 7,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[8],
      mode: 8,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Min }],
    },
    {
      label: RvcCleanModeDisplayMap[9],
      mode: 9,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
    },
    {
      label: RvcCleanModeDisplayMap[10],
      mode: 10,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
    },

    {
      label: RvcCleanModeDisplayMap[11],
      mode: 11,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
    },

    {
      label: RvcCleanModeDisplayMap[12],
      mode: 12,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[13],
      mode: 13,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
    },
    {
      label: RvcCleanModeDisplayMap[14],
      mode: 14,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
    },
    {
      label: RvcCleanModeDisplayMap[15],
      mode: 15,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
    },
    {
      label: RvcCleanModeDisplayMap[16],
      mode: 16,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: RvcCleanModeDisplayMap[17],
      mode: 17,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[18],
      mode: 18,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
    },
    {
      label: RvcCleanModeDisplayMap[19],
      mode: 19,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
  ];
}

export function getOperationalStatesSmart(): RvcOperationalState.OperationalStateStruct[] {
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
