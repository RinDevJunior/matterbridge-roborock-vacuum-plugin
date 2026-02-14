import { DockErrorCode, OperationStatusCode, VacuumErrorCode } from '../enums/index.js';
import { DockInfo } from './dockInfo.js';
import { CloudMessageResult } from './messageResult.js';
import { VacuumError } from './vacuumError.js';

export class StatusChangeMessage {
  constructor(
    public readonly duid: string,
    public readonly status: OperationStatusCode,
    public readonly inCleaning: boolean | undefined,
    public readonly inReturning: boolean | undefined,
    public readonly inFreshState: boolean | undefined,
    public readonly isLocating: boolean | undefined,
    public readonly isExploring: boolean | undefined,
    public readonly inWarmup: boolean | undefined,
  ) {}
}

export class DeviceStatus {
  errorStatus: VacuumError;

  constructor(
    public readonly duid: string,
    private readonly message: CloudMessageResult,
  ) {
    this.errorStatus = new VacuumError(this.duid, this.message.error_code, this.message.dock_error_status, this.message.dss);
  }

  getMessage(): CloudMessageResult {
    return this.message;
  }

  getBattery(): number {
    return this.message.battery;
  }

  getChargeStatus(): number {
    return this.message.charge_status;
  }

  getVacuumErrorCode(): VacuumErrorCode {
    return this.message.error_code;
  }

  getDockInfo(): DockInfo {
    return new DockInfo(this.message.dock_type);
  }

  getDockErrorCode(): DockErrorCode {
    return this.message.dock_error_status;
  }

  getDockStationStatus(): number | undefined {
    return this.message.dss;
  }
}
