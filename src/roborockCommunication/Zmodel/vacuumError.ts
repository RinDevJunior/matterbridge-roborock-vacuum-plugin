import { DockErrorCode, VacuumErrorCode } from '../Zenum/vacuumAndDockErrorCode.js';

export default class VacuumError {
  private readonly vacuumErrorCode: VacuumErrorCode;
  private readonly dockErrorCode: DockErrorCode;

  constructor(errorCode: VacuumErrorCode, dockErrorCode: DockErrorCode) {
    this.vacuumErrorCode = errorCode;
    this.dockErrorCode = dockErrorCode;
  }

  hasError() {
    return this.vacuumErrorCode != 0 || this.dockErrorCode != 0;
  }

  isStuck(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.robot_trapped;
  }

  isBatteryLow(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.low_battery;
  }

  isBinFull(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.clean_auto_empty_dock || this.dockErrorCode == DockErrorCode.duct_blockage;
  }

  isCleanWaterEmpty(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.clear_water_box_exception || this.dockErrorCode == DockErrorCode.water_empty;
  }

  isWasteWaterFull(): boolean {
    return this.dockErrorCode == DockErrorCode.waste_water_tank_full;
  }
}
