import { PowerSource } from 'matterbridge/matter/clusters';
import { OperationStatusCode } from '../roborockCommunication/Zenum/operationStatusCode.js';

export function getBatteryStatus(batteryLevel?: number): PowerSource.BatChargeLevel {
  if (batteryLevel === undefined) return PowerSource.BatChargeLevel.Ok;

  if (batteryLevel >= 70) {
    return PowerSource.BatChargeLevel.Ok;
  } else if (batteryLevel >= 40) {
    return PowerSource.BatChargeLevel.Warning;
  } else {
    return PowerSource.BatChargeLevel.Critical;
  }
}

export function getBatteryState(deviceState: number, batRemaining: number): PowerSource.BatChargeState {
  if (deviceState == OperationStatusCode.Charging) {
    return batRemaining < 100 ? PowerSource.BatChargeState.IsCharging : PowerSource.BatChargeState.IsAtFullCharge;
  }

  if (deviceState == OperationStatusCode.ChargingError) {
    return PowerSource.BatChargeState.IsNotCharging;
  }

  return PowerSource.BatChargeState.IsAtFullCharge;
}
