import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getDefaultSupportedRunModes } from '../behaviors/roborock.vacuum/default/initialData.js';

export function getRunningMode(modeTag: RvcRunMode.ModeTag | undefined): number | null {
  if (!modeTag) return null;

  const supportedMode = getDefaultSupportedRunModes();
  const runningMode = supportedMode.find((s) => s.modeTags.some((mt) => mt.value === modeTag));
  return runningMode?.mode ?? null;
}

export function getSupportedRunModes(): RvcRunMode.ModeOption[] {
  return getDefaultSupportedRunModes();
}
