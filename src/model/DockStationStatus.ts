import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { DockErrorCode } from '../roborockCommunication/enums/vacuumAndDockErrorCode.js';

export enum DockStationStatusCode {
  Unknown = 0,
  Error = 1,
  OK = 2,
}

/**
 * Bit layout of docking station status value:
 * - Bits 0-1:   isUpdownWaterReady
 * - Bits 2-3:   clearWaterBoxStatus
 * - Bits 4-5:   dirtyWaterBoxStatus
 * - Bits 6-7:   dustBagStatus
 * - Bits 8-9:   waterBoxFilterStatus
 * - Bits 10-11: cleanFluidStatus
 */

const BIT_MASK_2BITS = 0b11;

const BitPosition = {
  IsUpdownWaterReady: 0,
  ClearWaterBox: 2,
  DirtyWaterBox: 4,
  DustBag: 6,
  WaterBoxFilter: 8,
  CleanFluid: 10,
} as const;

function extractBits(value: number, position: number): number {
  return (value >> position) & BIT_MASK_2BITS;
}

export class DockStationStatus {
  constructor(
    public readonly cleanFluidStatus: DockStationStatusCode,
    public readonly waterBoxFilterStatus: DockStationStatusCode,
    public readonly dustBagStatus: DockStationStatusCode,
    public readonly dirtyWaterBoxStatus: DockStationStatusCode,
    public readonly clearWaterBoxStatus: DockStationStatusCode,
    public readonly isUpdownWaterReady: DockStationStatusCode,
  ) {}

  public hasError(): boolean {
    return (
      this.cleanFluidStatus === DockStationStatusCode.Error ||
      this.waterBoxFilterStatus === DockStationStatusCode.Error ||
      this.dustBagStatus === DockStationStatusCode.Error ||
      this.dirtyWaterBoxStatus === DockStationStatusCode.Error ||
      this.clearWaterBoxStatus === DockStationStatusCode.Error
      // || this.isUpdownWaterReady === DockStationStatusCode.Error
    );
  }

  public getMatterOperationalError(): RvcOperationalState.ErrorState {
    if (this.cleanFluidStatus === DockStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankMissing;
    }
    if (this.waterBoxFilterStatus === DockStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankLidOpen;
    }
    if (this.dustBagStatus === DockStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.DustBinFull;
    }
    if (this.dirtyWaterBoxStatus === DockStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.DirtyWaterTankFull;
    }
    if (this.clearWaterBoxStatus === DockStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankEmpty;
    }

    return RvcOperationalState.ErrorState.NoError;
  }

  public static parseDockStationStatus(dss: number): DockStationStatus {
    return new DockStationStatus(
      extractBits(dss, BitPosition.CleanFluid),
      extractBits(dss, BitPosition.WaterBoxFilter),
      extractBits(dss, BitPosition.DustBag),
      extractBits(dss, BitPosition.DirtyWaterBox),
      extractBits(dss, BitPosition.ClearWaterBox),
      extractBits(dss, BitPosition.IsUpdownWaterReady),
    );
  }

  public static parseDockErrorCode(dockErrorCode: DockErrorCode): RvcOperationalState.ErrorState {
    switch (dockErrorCode) {
      case DockErrorCode.WaterEmpty:
        return RvcOperationalState.ErrorState.WaterTankEmpty;
      case DockErrorCode.DuctBlockage:
        return RvcOperationalState.ErrorState.DustBinFull;
      case DockErrorCode.WasteWaterTankFull:
      case DockErrorCode.CleaningTankFullOrBlocked:
        return RvcOperationalState.ErrorState.DirtyWaterTankFull;
      case DockErrorCode.MaintenanceBrushJammed:
        return RvcOperationalState.ErrorState.BrushJammed;
      case DockErrorCode.DirtyTankLatchOpen:
        return RvcOperationalState.ErrorState.DirtyWaterTankMissing;
      case DockErrorCode.NoDustbin:
        return RvcOperationalState.ErrorState.DustBinMissing;
      case DockErrorCode.None:
        return RvcOperationalState.ErrorState.NoError;
      default:
        return RvcOperationalState.ErrorState.UnableToCompleteOperation;
    }
  }
}
