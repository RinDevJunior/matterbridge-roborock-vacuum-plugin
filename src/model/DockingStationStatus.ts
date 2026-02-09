import { RvcOperationalState } from 'matterbridge/matter/clusters';

export enum DockingStationStatusCode {
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

export class DockingStationStatus {
  constructor(
    public readonly cleanFluidStatus: DockingStationStatusCode,
    public readonly waterBoxFilterStatus: DockingStationStatusCode,
    public readonly dustBagStatus: DockingStationStatusCode,
    public readonly dirtyWaterBoxStatus: DockingStationStatusCode,
    public readonly clearWaterBoxStatus: DockingStationStatusCode,
    public readonly isUpdownWaterReady: DockingStationStatusCode,
  ) {}

  public hasError(): boolean {
    return (
      this.cleanFluidStatus === DockingStationStatusCode.Error ||
      this.waterBoxFilterStatus === DockingStationStatusCode.Error ||
      this.dustBagStatus === DockingStationStatusCode.Error ||
      this.dirtyWaterBoxStatus === DockingStationStatusCode.Error ||
      this.clearWaterBoxStatus === DockingStationStatusCode.Error
      // || this.isUpdownWaterReady === DockingStationStatusCode.Error
    );
  }

  public getMatterOperationalError(): RvcOperationalState.ErrorState {
    if (this.cleanFluidStatus === DockingStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankMissing;
    }
    if (this.waterBoxFilterStatus === DockingStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankLidOpen;
    }
    if (this.dustBagStatus === DockingStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.DustBinFull;
    }
    if (this.dirtyWaterBoxStatus === DockingStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.DirtyWaterTankFull;
    }
    if (this.clearWaterBoxStatus === DockingStationStatusCode.Error) {
      return RvcOperationalState.ErrorState.WaterTankEmpty;
    }

    return RvcOperationalState.ErrorState.NoError;
  }

  public static parseDockingStationStatus(dss: number): DockingStationStatus {
    return new DockingStationStatus(
      extractBits(dss, BitPosition.CleanFluid),
      extractBits(dss, BitPosition.WaterBoxFilter),
      extractBits(dss, BitPosition.DustBag),
      extractBits(dss, BitPosition.DirtyWaterBox),
      extractBits(dss, BitPosition.ClearWaterBox),
      extractBits(dss, BitPosition.IsUpdownWaterReady),
    );
  }
}
