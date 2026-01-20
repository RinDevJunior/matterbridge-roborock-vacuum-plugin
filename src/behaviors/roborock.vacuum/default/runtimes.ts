import { CleanModeDTO } from '@/behaviors/CleanModeDTO.js';
import { DefaultCleanSetting as CleanSetting, MopRoute, MopWaterFlow, VacuumSuctionPower } from './default.js';

/**
 * Determine current clean mode based on device settings.
 * Maps suction power, water flow, and mop route to a clean mode identifier.
 * @param setting - Clean mode settings from device
 * @returns Clean mode identifier or undefined if no match found
 */
export function getCurrentCleanModeDefault(setting: CleanModeDTO): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  if (setting.suctionPower === VacuumSuctionPower.Custom || setting.waterFlow === MopWaterFlow.Custom || setting.mopRoute === MopRoute.Custom) {
    return 10; // 'Vac & Mop Custom'
  }

  for (const [key, value] of Object.entries(CleanSetting)) {
    if (value.suctionPower === setting.suctionPower && value.waterFlow === setting.waterFlow && value.mopRoute === setting.mopRoute) {
      return Number(key);
    }
  }

  if (setting.suctionPower === VacuumSuctionPower.Off) return 31; // 'Mop Default'
  if (setting.waterFlow === MopWaterFlow.Off) return 66; // 'Vacuum Default'
  if (setting.suctionPower !== VacuumSuctionPower.Off && setting.waterFlow !== MopWaterFlow.Off) return 5; // 'Vac & Mop Default'

  return undefined;
}
