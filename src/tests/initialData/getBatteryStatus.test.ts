import { describe, expect, it } from 'vitest';

import { getBatteryState, getBatteryStatus } from '../../initialData/getBatteryStatus.js';
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
});
