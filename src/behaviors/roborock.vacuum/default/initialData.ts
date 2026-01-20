import { RvcCleanMode, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { DefaultRvcCleanMode as RvcCleanModeDisplayMap } from './default.js';
import { ExperimentalFeatureSetting } from '@/model/index.js';

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

export function getDefaultSupportedCleanModes(enableExperimentalFeature: ExperimentalFeatureSetting | undefined): RvcCleanMode.ModeOption[] {
  const result = [
    {
      label: RvcCleanModeDisplayMap[5],
      mode: 5,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
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
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.LowEnergy }],
    },

    {
      label: RvcCleanModeDisplayMap[31],
      mode: 31,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
    },

    {
      label: RvcCleanModeDisplayMap[32],
      mode: 32,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[33],
      mode: 33,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
    },
    {
      label: RvcCleanModeDisplayMap[34],
      mode: 34,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
    },
    {
      label: RvcCleanModeDisplayMap[35],
      mode: 35,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
    },

    {
      label: RvcCleanModeDisplayMap[66],
      mode: 66,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: RvcCleanModeDisplayMap[67],
      mode: 67,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[68],
      mode: 68,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
    },
    {
      label: RvcCleanModeDisplayMap[69],
      mode: 69,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
  ];

  if (enableExperimentalFeature?.advancedFeature?.useVacationModeToSendVacuumToDock ?? false) {
    return [
      ...result,
      {
        label: RvcCleanModeDisplayMap[99],
        mode: 99,
        modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
      },
    ];
  }

  return result;
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
