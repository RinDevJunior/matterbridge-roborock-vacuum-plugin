import { CleanSetting, MopWaterFlow, VacuumSuctionPower } from './default.js';

export function getCurrentCleanModeDefault(setting: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }): number | undefined {
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

  if (setting.suctionPower == VacuumSuctionPower.Off) return 11; // 'Mop Default'
  if (setting.waterFlow == MopWaterFlow.Off) return 16; // 'Vacuum Default'
  if ((setting.suctionPower !== VacuumSuctionPower.Off && setting.waterFlow) !== MopWaterFlow.Off) return 5; // 'Vac & Mop Default'

  return undefined;
}
