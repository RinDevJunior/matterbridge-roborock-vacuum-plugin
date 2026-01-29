import { RvcRunMode } from 'matterbridge/matter/clusters';
import { baseRunModeConfigs } from '../behaviors/roborock.vacuum/core/runModeConfig.js';

export function getRunningMode(modeTag: RvcRunMode.ModeTag | undefined): number | null {
  if (!modeTag) return null;

  const runningMode = baseRunModeConfigs.find((s) => s.modeTags?.some((mt) => mt.value === modeTag));
  return runningMode?.mode ?? null;
}
