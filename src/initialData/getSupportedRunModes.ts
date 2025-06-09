import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getSupportedRunModesSmart } from '../behaviors/roborock.vacuum/smart/initalData.js';
import { getDefaultSupportedRunModes } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export function getRunningMode(model: string | undefined, modeTag: RvcRunMode.ModeTag | undefined): number | null {
  if (!model || !modeTag) return null;

  const supportedMode = getSupportedRunModes(model);
  const runningMode = supportedMode.find((s) => s.modeTags.some((mt) => mt.value === modeTag));
  return runningMode?.mode ?? null;
}

export function getSupportedRunModes(model: string): RvcRunMode.ModeOption[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getSupportedRunModesSmart();

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_MAXV_ULTRA:
    case DeviceModel.S6_PURE:
    default:
      return getDefaultSupportedRunModes();
  }
}
