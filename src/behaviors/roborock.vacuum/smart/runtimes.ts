import { CleanSetting, MopRouteSmart, MopWaterFlowSmart, VacuumSuctionPowerSmart } from './smart.js';

export function getCurrentCleanModeSmart(setting: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  if (setting.suctionPower === VacuumSuctionPowerSmart.Smart || setting.waterFlow === MopWaterFlowSmart.Smart || setting.mopRoute === MopRouteSmart.Smart) {
    return 4; // 'Smart Plan'
  }

  if (setting.suctionPower === VacuumSuctionPowerSmart.Custom || setting.waterFlow === MopWaterFlowSmart.Custom || setting.mopRoute === MopRouteSmart.Custom) {
    return 10; // 'Vac & Mop Custom'
  }

  for (const [key, value] of Object.entries(CleanSetting)) {
    if (value.suctionPower === setting.suctionPower && value.waterFlow === setting.waterFlow && value.mopRoute === setting.mopRoute) {
      return Number(key);
    }
  }

  if (setting.suctionPower == VacuumSuctionPowerSmart.Off) return 11; // 'Mop Default'
  if (setting.waterFlow == MopWaterFlowSmart.Off) return 16; // 'Vacuum Default'
  if ((setting.suctionPower !== VacuumSuctionPowerSmart.Off && setting.waterFlow) !== MopWaterFlowSmart.Off) return 5; // 'Vac & Mop Default'

  return undefined;
}
