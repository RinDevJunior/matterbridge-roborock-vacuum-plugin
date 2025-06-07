import { MopWaterFlowA51, VacuumSuctionPowerA51 } from './a51.js';

export function getCurrentCleanModeA51(fan_power: number | undefined, water_box_mode: number | undefined): number | undefined {
  if (!fan_power || !water_box_mode) return undefined;
  if (fan_power == VacuumSuctionPowerA51.Custom || water_box_mode == MopWaterFlowA51.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA51.Off) return 5; // 'Mop',
  if (water_box_mode == MopWaterFlowA51.Off)
    return 6; // 'Vacuum',
  else return 7; // Vac & Mop
}

export function getCurrentCleanModeFromFanPowerA51(fan_power: number | undefined): number | undefined {
  if (!fan_power) return undefined;
  if (fan_power == VacuumSuctionPowerA51.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA51.Off)
    return 5; // 'Mop',
  else return undefined;
}

export function getCurrentCleanModeFromWaterBoxModeA51(water_box_mode: number | undefined): number | undefined {
  if (!water_box_mode) return undefined;
  if (water_box_mode == MopWaterFlowA51.Custom) return 8; // 'Custom',
  if (water_box_mode == MopWaterFlowA51.Off)
    return 6; // 'Vacuum',
  else return undefined;
}
