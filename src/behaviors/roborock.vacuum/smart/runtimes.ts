import { CleanSetting, MopWaterFlowSmart, VacuumSuctionPowerSmart } from './smart.js';

export function getCurrentCleanModeSmart(setting: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }): number | undefined {
  if (!setting || typeof setting !== 'object') {
    return undefined;
  }

  for (const [key, value] of Object.entries(CleanSetting)) {
    if (
      value.suctionPower === setting.suctionPower &&
      value.waterFlow === setting.waterFlow &&
      value.distance_off === setting.distance_off &&
      value.mopRoute === setting.mopRoute
    ) {
      return Number(key);
    }
  }

  if (setting.suctionPower == VacuumSuctionPowerSmart.Off) return 11; // 'Mop Default'
  if (setting.waterFlow == MopWaterFlowSmart.Off) return 16; // 'Vacuum Default'
  if ((setting.suctionPower !== VacuumSuctionPowerSmart.Off && setting.waterFlow) !== MopWaterFlowSmart.Off) return 5; // 'Vac & Mop Default'

  return undefined;
}
