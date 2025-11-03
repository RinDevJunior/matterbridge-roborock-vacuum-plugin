import { CleanModeSetting } from '../default/default.js';
import { getCurrentCleanModeDefault } from '../default/runtimes.js';
import { MopRouteSmart, MopWaterFlowSmart, VacuumSuctionPowerSmart } from './smart.js';

export function getCurrentCleanModeSmart(setting: CleanModeSetting): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  if (setting.suctionPower === VacuumSuctionPowerSmart.Smart || setting.waterFlow === MopWaterFlowSmart.Smart || setting.mopRoute === MopRouteSmart.Smart) {
    return 4; // 'Smart Plan'
  }

  return getCurrentCleanModeDefault(setting);
}
