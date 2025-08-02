import { getCurrentCleanModeDefault } from '../default/runtimes.js';
import { MopRouteSmart, MopWaterFlowSmart, VacuumSuctionPowerSmart } from './smart.js';

export function getCurrentCleanModeSmart(setting: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number | undefined }): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  if (setting.suctionPower === VacuumSuctionPowerSmart.Smart || setting.waterFlow === MopWaterFlowSmart.Smart || setting.mopRoute === MopRouteSmart.Smart) {
    return 4; // 'Smart Plan'
  }

  return getCurrentCleanModeDefault(setting);
}
