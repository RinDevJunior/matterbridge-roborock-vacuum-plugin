import { VacuumErrorCode } from '../enums/index.js';
import { DeviceStatus } from './deviceStatus.js';
import { CloudMessageResult } from './messageResult.js';

export interface BatteryMessage {
  duid: string;
  percentage: number;
}

export interface DeviceErrorMessage {
  duid: string;
  errorCode: VacuumErrorCode;
}

export interface DeviceStatusNotify extends DeviceStatus, CloudMessageResult {
  duid: string;
}
