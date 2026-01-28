import { RvcCleanMode, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { baseCleanModeConfigs, CleanModeDisplayLabel, CleanModeLabelInfo, getModeOptions } from '../core/modeConfig.js';
import { PlatformConfigManager } from '../../../platform/platformConfig.js';

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

export function getDefaultSupportedCleanModes(configManager: PlatformConfigManager): RvcCleanMode.ModeOption[] {
  const modes = getModeOptions(baseCleanModeConfigs);

  // Add vacation mode if enabled
  if (configManager.useVacationModeToSendVacuumToDock) {
    modes.push({
      mode: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode,
      label: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
    });
  }

  return modes;
}

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
