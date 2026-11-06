import { PowerSource } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { getBatteryState, getBatteryStatus } from '../../initialData/getBatteryStatus.js';
import { ChargeStatus } from '../../roborockCommunication/enums/chargeStatus.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/operationStatusCode.js';
import { asType } from '../testUtils.js';

describe('getBatteryStatus', () => {
	it('battery level undefined -> Ok', () => {
		expect(getBatteryStatus(undefined)).toBeDefined();
	});

	it('battery levels map to categories', () => {
		expect(getBatteryStatus(80)).toBe(getBatteryStatus(80));
		expect(getBatteryStatus(50)).toBeDefined();
		expect(getBatteryStatus(10)).toBeDefined();
	});

	it('getBatteryState charging vs error vs default', () => {
		expect(getBatteryState(OperationStatusCode.Charging, 50)).toBeDefined();
		expect(getBatteryState(OperationStatusCode.Charging, 100)).toBeDefined();
		expect(getBatteryState(OperationStatusCode.ChargingError, 10)).toBeDefined();
		expect(getBatteryState(asType<OperationStatusCode>(999), 0)).toBeDefined();
	});

	describe('getBatteryState off-peak (valley electricity) condition', () => {
		const valleyOn = { chargeStatus: ChargeStatus.ChargeWaiting, valleyElectricitySupported: true };

		it('should return IsNotCharging when charging, valley supported, chargeStatus is ChargeWaiting and battery below full', () => {
			// Arrange
			const state = OperationStatusCode.Charging;

			// Act
			const result = getBatteryState(state, 50, valleyOn);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsNotCharging);
		});

		it('should return IsNotCharging when battery is 99% (just below full)', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.Charging, 99, valleyOn);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsNotCharging);
		});

		it('should return IsCharging when valley electricity is not supported even if chargeStatus is ChargeWaiting', () => {
			// Arrange
			const options = { chargeStatus: ChargeStatus.ChargeWaiting, valleyElectricitySupported: false };

			// Act
			const result = getBatteryState(OperationStatusCode.Charging, 50, options);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsCharging when valley electricity flag is undefined', () => {
			// Arrange
			const options = { chargeStatus: ChargeStatus.ChargeWaiting };

			// Act
			const result = getBatteryState(OperationStatusCode.Charging, 50, options);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsCharging when chargeStatus is Charging (1) even if valley is supported', () => {
			// Arrange
			const options = { chargeStatus: ChargeStatus.Charging, valleyElectricitySupported: true };

			// Act
			const result = getBatteryState(OperationStatusCode.Charging, 50, options);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsCharging when chargeStatus is Unknown (-1) even if valley is supported', () => {
			// Arrange
			const options = { chargeStatus: ChargeStatus.Unknown, valleyElectricitySupported: true };

			// Act
			const result = getBatteryState(OperationStatusCode.Charging, 50, options);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsCharging when chargeStatus is undefined even if valley is supported', () => {
			// Arrange
			const options = { chargeStatus: undefined, valleyElectricitySupported: true };

			// Act
			const result = getBatteryState(OperationStatusCode.Charging, 50, options);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsAtFullCharge over the valley check when battery is 100 with ChargeWaiting', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.Charging, 100, valleyOn);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsAtFullCharge);
		});

		it('should return IsCharging when state is Idle even with valley supported and ChargeWaiting', () => {
			// Arrange
			const state = OperationStatusCode.Idle;

			// Act
			const result = getBatteryState(state, 50, valleyOn);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsNotCharging when state is ChargingError regardless of options', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.ChargingError, 50, valleyOn);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsNotCharging);
		});

		it('should return IsCharging for two-argument calls, matching the pre-change behavior', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.Charging, 50);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsCharging);
		});

		it('should return IsAtFullCharge for two-argument calls at 100%', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.Charging, 100);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsAtFullCharge);
		});

		it('should return IsNotCharging for two-argument calls in a non-charging state', () => {
			// Arrange & Act
			const result = getBatteryState(OperationStatusCode.ChargingError, 50);

			// Assert
			expect(result).toBe(PowerSource.BatChargeState.IsNotCharging);
		});
	});
});
