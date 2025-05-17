import { DockErrorCode, VacuumErrorCode } from '../Zenum/vacuumAndDockErrorCode.js';
import DockInfo from './dockInfo.js';
import { CloudMessageResult } from './messageResult.js';
import VacuumError from './vacuumError.js';

export default class DeviceStatus {
  errorStatus: VacuumError;
  private readonly message: CloudMessageResult;

  constructor(message: CloudMessageResult) {
    this.message = message;
    this.errorStatus = new VacuumError(message.error_code, message.dock_error_status);
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
