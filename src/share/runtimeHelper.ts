import { getCurrentCleanModeA187, getCurrentCleanModeFromFanPowerA187, getCurrentCleanModeFromWaterBoxModeA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/runtimes.js';
import { getCurrentCleanModeA27, getCurrentCleanModeFromFanPowerA27, getCurrentCleanModeFromWaterBoxModeA27 } from '../behaviors/roborock.vacuum/S7_MAXV/runtimes.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export type CleanModeFunc1 = (fan_power: number | undefined, water_box_mode: number | undefined) => number | undefined;
export type CleanModeFunc2 = (config: number | undefined) => number | undefined;

export function getCurrentCleanModeFunc(model: string): CleanModeFunc1 {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      return getCurrentCleanModeA187;
    }
    case DeviceModel.S7_MAXV: {
      return getCurrentCleanModeA27;
    }
    default:
      return (_, __) => undefined;
  }
}

export function getCurrentCleanModeFromFanPowerFunc(model: string): CleanModeFunc2 {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      return getCurrentCleanModeFromFanPowerA187;
    }
    case DeviceModel.S7_MAXV: {
      return getCurrentCleanModeFromFanPowerA27;
    }
    default:
      return (_) => undefined;
  }
}

export function getCurrentCleanModeFromWaterBoxModeFunc(model: string): CleanModeFunc2 {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      return getCurrentCleanModeFromWaterBoxModeA187;
    }
    case DeviceModel.S7_MAXV: {
      return getCurrentCleanModeFromWaterBoxModeA27;
    }
    default:
      return (_) => undefined;
  }
}
