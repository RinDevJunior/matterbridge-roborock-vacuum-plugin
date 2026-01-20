import { CleanModeDTO, getCurrentCleanModeDefault } from '@/behaviors/index.js';
import { MopRouteSmart, MopWaterFlowSmart, VacuumSuctionPowerSmart } from './smart.js';

/**
 * Determine current clean mode for smart models based on device settings.
 * Smart models support additional 'Smart Plan' mode when smart settings are detected.
 * @param setting - Clean mode settings from device
 * @returns Clean mode identifier or undefined if no match found
 */
export function getCurrentCleanModeSmart(setting: CleanModeDTO): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  if (setting.suctionPower === VacuumSuctionPowerSmart.Smart || setting.waterFlow === MopWaterFlowSmart.Smart || setting.mopRoute === MopRouteSmart.Smart) {
    return 4; // 'Smart Plan'
  }

  return getCurrentCleanModeDefault(setting);
}
