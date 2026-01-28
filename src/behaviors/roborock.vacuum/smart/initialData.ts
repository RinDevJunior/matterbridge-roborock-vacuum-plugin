import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getModeOptions, smartCleanModeConfigs } from '../core/modeConfig.js';
import { PlatformConfigManager } from '../../../platform/platformConfig.js';

/**
 * Get supported clean modes for smart vacuum models.
 * Adds 'Smart Plan' mode (4) and day mode (5) to the default clean modes.
 */
export function getSmartSupportedCleanModes(configManager: PlatformConfigManager): RvcCleanMode.ModeOption[] {
  const smartModes = getModeOptions(smartCleanModeConfigs);

  // Add vacation mode if enabled
  if (configManager.useVacationModeToSendVacuumToDock) {
    smartModes.push({
      label: 'Go Vacation',
      mode: 99,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
    });
  }

  return smartModes;
}
