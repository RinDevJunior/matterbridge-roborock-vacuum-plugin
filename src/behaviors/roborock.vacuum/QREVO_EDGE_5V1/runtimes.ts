import { MopWaterFlowA187, VacuumSuctionPowerA187 } from './a187.js';

export function getCurrentCleanModeA187(fan_power: number | undefined, water_box_mode: number | undefined): number | undefined {
  if (!fan_power || !water_box_mode) return undefined;
  if (fan_power == VacuumSuctionPowerA187.Smart || water_box_mode == MopWaterFlowA187.Smart) return 4; // 'Smart Plan',
  if (fan_power == VacuumSuctionPowerA187.Custom || water_box_mode == MopWaterFlowA187.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA187.Off) return 5; // 'Mop',
  if (water_box_mode == MopWaterFlowA187.Off)
    return 6; // 'Vacuum',
  else return 7; //Vac & Mop
}

export function getCurrentCleanModeFromFanPowerA187(fan_power: number | undefined): number | undefined {
  if (!fan_power) return undefined;
  if (fan_power == VacuumSuctionPowerA187.Smart) return 4; // 'Smart Plan',
  if (fan_power == VacuumSuctionPowerA187.Custom) return 8; // 'Custom',
  if (fan_power == VacuumSuctionPowerA187.Off)
    return 5; // 'Mop',
  else return undefined;
}

export function getCurrentCleanModeFromWaterBoxModeA187(water_box_mode: number | undefined): number | undefined {
  if (!water_box_mode) return undefined;
  if (water_box_mode == MopWaterFlowA187.Smart) return 4; // 'Smart Plan',
  if (water_box_mode == MopWaterFlowA187.Custom) return 8; // 'Custom',
  if (water_box_mode == MopWaterFlowA187.Off)
    return 6; // 'Vacuum',
  else return undefined;
}
