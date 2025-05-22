import { DockErrorCode, VacuumErrorCode } from '../Zenum/vacuumAndDockErrorCode.js';

export class VacuumError {
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
    return this.vacuumErrorCode === VacuumErrorCode.RobotTrapped;
  }

  isBatteryLow(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.LowBattery;
  }

  isBinFull(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.CleanAutoEmptyDock || this.dockErrorCode == DockErrorCode.DuctBlockage;
  }

  isCleanWaterEmpty(): boolean {
    return this.vacuumErrorCode === VacuumErrorCode.ClearWaterTankEmpty || this.dockErrorCode == DockErrorCode.WaterEmpty;
  }

  isWasteWaterFull(): boolean {
    return this.dockErrorCode == DockErrorCode.WasteWaterTankFull;
  }
}
