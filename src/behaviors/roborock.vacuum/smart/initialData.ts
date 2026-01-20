import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { SmartRvcCleanMode as RvcCleanModeDisplayMap } from './smart.js';
import { getDefaultSupportedCleanModes } from '../default/initialData.js';
import { ExperimentalFeatureSetting } from '../../../model/ExperimentalFeatureSetting.js';

/**
 * Get supported clean modes for smart vacuum models.
 * Adds 'Smart Plan' mode (4) and day mode (5) to the default clean modes.
 * @param enableExperimentalFeature - Experimental feature settings
 * @returns Array of supported clean mode configurations for smart models
 */
export function getSupportedCleanModesSmart(enableExperimentalFeature: ExperimentalFeatureSetting | undefined): RvcCleanMode.ModeOption[] {
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
    ...getDefaultSupportedCleanModes(enableExperimentalFeature).filter((x) => x.mode !== 4 && x.mode !== 5), // Exclude modes 4 and 5 which are already defined
  ];
}
