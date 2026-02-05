import { PowerSource } from 'matterbridge/matter/clusters';
import { OperationStatusCode } from '../roborockCommunication/enums/index.js';
import { BATTERY_THRESHOLD_OK, BATTERY_THRESHOLD_WARNING, BATTERY_FULL } from '../constants/index.js';

/**
 * Determine battery charge level based on percentage.
 * @param batteryLevel - Battery percentage (0-100)
 * @returns Battery charge level: Ok (>=70%), Warning (40-69%), or Critical (<40%)
 */
export function getBatteryStatus(batteryLevel?: number): PowerSource.BatChargeLevel {
  if (batteryLevel === undefined) return PowerSource.BatChargeLevel.Ok;

  if (batteryLevel >= BATTERY_THRESHOLD_OK) {
    return PowerSource.BatChargeLevel.Ok;
  } else if (batteryLevel >= BATTERY_THRESHOLD_WARNING) {
    return PowerSource.BatChargeLevel.Warning;
  } else {
    return PowerSource.BatChargeLevel.Critical;
  }
}

/**
 * Determine battery charge state based on device status.
 */
export function getBatteryState(deviceState: number, batRemaining: number): PowerSource.BatChargeState {
  if (deviceState === OperationStatusCode.Charging || deviceState === OperationStatusCode.Idle) {
    return batRemaining < BATTERY_FULL ? PowerSource.BatChargeState.IsCharging : PowerSource.BatChargeState.IsAtFullCharge;
  }

  if (deviceState === OperationStatusCode.ChargingError) {
    return PowerSource.BatChargeState.IsNotCharging;
  }

  return PowerSource.BatChargeState.IsAtFullCharge;
}
