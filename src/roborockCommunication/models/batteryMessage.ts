import { OperationStatusCode, VacuumErrorCode } from '../enums/index.js';
import { DeviceStatus } from './deviceStatus.js';
import { CloudMessageResult } from './messageResult.js';

export class BatteryMessage {
  constructor(
    public readonly duid: string,
    public readonly percentage: number,
    public readonly chargeStatus: number | undefined,
    public readonly deviceStatus: OperationStatusCode | undefined,
  ) {}
}

export interface DeviceErrorMessage {
  duid: string;
  errorCode: VacuumErrorCode;
}

export interface DeviceStatusNotify extends DeviceStatus, CloudMessageResult {
  duid: string;
}
