import { RvcRunMode } from 'matterbridge/matter/clusters';
import { RunModeConfigs } from '../behaviors/roborock.vacuum/core/initialData.js';

export function getRunningMode(modeTag: RvcRunMode.ModeTag | undefined): number | null {
  if (!modeTag) return null;

  const runningMode = Object.values(RunModeConfigs).find((s) => s.modeTags?.some((mt) => mt.value === modeTag));
  return runningMode?.mode ?? null;
}
