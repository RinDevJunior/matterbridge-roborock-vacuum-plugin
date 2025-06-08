import { MopWaterFlowA27, VacuumSuctionPowerA27 } from './a27.js';

export function getCurrentCleanModeA27(fan_power: number | undefined, water_box_mode: number | undefined): number | undefined {
  if (!fan_power || !water_box_mode) return undefined;
  if (fan_power == VacuumSuctionPowerA27.Custom || water_box_mode == MopWaterFlowA27.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA27.Off) return 5; // 'Mop',
  if (water_box_mode == MopWaterFlowA27.Off)
    return 6; // 'Vacuum',
  else return 7; // Vac & Mop
}

export function getCurrentCleanModeFromFanPowerA27(fan_power: number | undefined): number | undefined {
  if (!fan_power) return undefined;
  if (fan_power == VacuumSuctionPowerA27.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA27.Off)
    return 5; // 'Mop',
  else return undefined;
}

export function getCurrentCleanModeFromWaterBoxModeA27(water_box_mode: number | undefined): number | undefined {
  if (!water_box_mode) return undefined;
  if (water_box_mode == MopWaterFlowA27.Custom) return 8; // 'Custom',
  if (water_box_mode == MopWaterFlowA27.Off)
    return 6; // 'Vacuum',
  else return undefined;
}
