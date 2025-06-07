import { MopWaterFlow, VacuumSuctionPower } from './default.js';

export function getCurrentCleanModeDefault(fan_power: number | undefined, water_box_mode: number | undefined): number | undefined {
  if (!fan_power || !water_box_mode) return undefined;
  if (fan_power == VacuumSuctionPower.Custom || water_box_mode == MopWaterFlow.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPower.Off) return 5; // 'Mop',
  if (water_box_mode == MopWaterFlow.Off)
    return 6; // 'Vacuum',
  else return 7; //Vac & Mop
}

export function getCurrentCleanModeFromFanPowerDefault(fan_power: number | undefined): number | undefined {
  if (!fan_power) return undefined;
  if (fan_power == VacuumSuctionPower.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPower.Off)
    return 5; // 'Mop',
  else return undefined;
}

export function getCurrentCleanModeFromWaterBoxModeDefault(water_box_mode: number | undefined): number | undefined {
  if (!water_box_mode) return undefined;
  if (water_box_mode == MopWaterFlow.Custom) return 8; // 'Custom',
  if (water_box_mode == MopWaterFlow.Off)
    return 6; // 'Vacuum',
  else return undefined;
}
