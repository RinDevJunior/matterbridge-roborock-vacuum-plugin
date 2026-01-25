import { DockErrorCode, VacuumErrorCode } from '../enums/index.js';
import { DockInfo } from './dockInfo.js';
import { CloudMessageResult } from './messageResult.js';
import { VacuumError } from './vacuumError.js';

export class DeviceStatus {
  errorStatus: VacuumError;
  message: CloudMessageResult;

  constructor(message: CloudMessageResult[]) {
    this.message = message[0];
    this.errorStatus = new VacuumError(this.message.error_code, this.message.dock_error_status);
  }

  getBattery(): number {
    return this.message.battery;
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
}
