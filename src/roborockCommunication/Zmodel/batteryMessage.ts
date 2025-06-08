import { DeviceStatus, VacuumErrorCode } from '../index.js';
import { CloudMessageResult } from './messageResult.js';

export interface BatteryMessage {
  duid: string;
  percentage: number;
}

export interface DeviceErrorMessage {
  duid: string;
  errorCode: VacuumErrorCode;
}

export type DeviceStatusNotify = { duid: string } & DeviceStatus & CloudMessageResult;
