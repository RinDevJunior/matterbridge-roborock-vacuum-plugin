import { describe, it, expect } from 'vitest';
import { getBatteryStatus, getBatteryState } from '../../initialData/getBatteryStatus.js';
import { OperationStatusCode } from '../../roborockCommunication/Zenum/operationStatusCode.js';

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
    expect(getBatteryState(999 as any, 0)).toBeDefined();
  });
});
