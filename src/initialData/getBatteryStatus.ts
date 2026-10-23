import { PowerSource } from 'matterbridge/matter/clusters';

import { BATTERY_FULL, BATTERY_THRESHOLD_OK, BATTERY_THRESHOLD_WARNING } from '../constants/index.js';
import { ChargeStatus, OperationStatusCode } from '../roborockCommunication/enums/index.js';

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
export function getBatteryState(
	deviceState: number,
	batRemaining: number,
	options?: { chargeStatus?: number; valleyElectricitySupported?: boolean },
): PowerSource.BatChargeState {
	if (deviceState === OperationStatusCode.Charging || deviceState === OperationStatusCode.Idle) {
		if (batRemaining >= BATTERY_FULL) return PowerSource.BatChargeState.IsAtFullCharge;

		if (
			deviceState === OperationStatusCode.Charging &&
			options?.valleyElectricitySupported === true &&
			options.chargeStatus === ChargeStatus.ChargeWaiting
		) {
			return PowerSource.BatChargeState.IsNotCharging;
		}

		return PowerSource.BatChargeState.IsCharging;
	}

	if (deviceState === OperationStatusCode.ChargingError) {
		return PowerSource.BatChargeState.IsNotCharging;
	}

	return PowerSource.BatChargeState.IsNotCharging;
}
