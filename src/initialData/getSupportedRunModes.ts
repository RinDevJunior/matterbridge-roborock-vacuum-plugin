import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getSupportedRunModesA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/initalData.js';
import { getDefaultSupportedRunModes } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { getSupportedRunModesA27 } from '../behaviors/roborock.vacuum/S7_MAXV/initalData.js';

export function getRunningMode(model: string | undefined, modeTag: RvcRunMode.ModeTag | undefined): number | null {
  if (!model || !modeTag) return null;

  const supportedMode = getSupportedRunModes(model);
  const runningMode = supportedMode.find((s) => s.modeTags.some((mt) => mt.value === modeTag));
  return runningMode?.mode ?? null;
}

export function getSupportedRunModes(model: string): RvcRunMode.ModeOption[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getSupportedRunModesA187();
    case DeviceModel.S7_MAXV:
      return getSupportedRunModesA27();
    default:
      return getDefaultSupportedRunModes();
  }
}
