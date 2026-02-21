import { DockErrorCode, VacuumErrorCode } from '../enums/index.js';

export class VacuumError {
  constructor(
    public readonly duid: string,
    public readonly vacuumErrorCode: VacuumErrorCode,
    public readonly dockErrorCode: DockErrorCode,
    public readonly dockStationStatus: number | undefined,
  ) {}

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
    return (
      this.vacuumErrorCode === VacuumErrorCode.CleanAutoEmptyDock || this.dockErrorCode == DockErrorCode.DuctBlockage
    );
  }

  isCleanWaterEmpty(): boolean {
    return (
      this.vacuumErrorCode === VacuumErrorCode.ClearWaterTankEmpty || this.dockErrorCode == DockErrorCode.WaterEmpty
    );
  }

  isWasteWaterFull(): boolean {
    return this.dockErrorCode == DockErrorCode.WasteWaterTankFull;
  }
}
