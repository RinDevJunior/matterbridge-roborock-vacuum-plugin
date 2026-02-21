import { DockStationStatus, DockStationStatusCode } from '../../model/DockStationStatus.js';
import { DockErrorCode } from '../../roborockCommunication/enums/vacuumAndDockErrorCode.js';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { describe, it, expect } from 'vitest';

describe('DockStationStatus', () => {
  it('should parse docking station status correctly', () => {
    const dss = 2729;
    const status = DockStationStatus.parseDockStationStatus(dss);

    expect(status.cleanFluidStatus).toBe(2);
    expect(status.waterBoxFilterStatus).toBe(2);
    expect(status.dustBagStatus).toBe(2);
    expect(status.dirtyWaterBoxStatus).toBe(2);
    expect(status.clearWaterBoxStatus).toBe(2);
    expect(status.isUpdownWaterReady).toBe(1);
  });

  it('should detect no error when all status fields are OK', () => {
    const dss = 168;
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.hasError()).toBe(false);
  });

  it('should detect error in any status field', () => {
    const status = new DockStationStatus(
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.Error,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
    );
    expect(status.hasError()).toBe(true);
  });

  it('should return true if error in any field', () => {
    const status = new DockStationStatus(
      2,
      2,
      2,
      2,
      1, // This means there is a problem with the clear water box
      1, // This means there is a problem with the updown water
    );
    expect(status.hasError()).toBe(true);
  });

  it('should handle missing clean water tank status gracefully', () => {
    const dss = 164; // Missing clean water tank status
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
    expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.OK);
    expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.Error);
    expect(status.hasError()).toBe(true);
  });

  it('should handle missing dirty water box status gracefully', () => {
    const dss = 152; // Missing dirty water box status
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
    expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.Error);
    expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.OK);
    expect(status.hasError()).toBe(true);
  });

  describe('getMatterOperationalError', () => {
    it('should return WaterTankMissing when cleanFluidStatus is Error', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.Error,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankMissing);
    });

    it('should return WaterTankLidOpen when waterBoxFilterStatus is Error', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.OK,
        DockStationStatusCode.Error,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankLidOpen);
    });

    it('should return DustBinFull when dustBagStatus is Error', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.Error,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.DustBinFull);
    });

    it('should return DirtyWaterTankFull when dirtyWaterBoxStatus is Error', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.Error,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.DirtyWaterTankFull);
    });

    it('should return WaterTankEmpty when clearWaterBoxStatus is Error', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.Error,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankEmpty);
    });

    it('should return NoError when no errors', () => {
      const status = new DockStationStatus(
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
        DockStationStatusCode.OK,
      );
      expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.NoError);
    });
  });

  describe('parseDockErrorCode', () => {
    it('should return NoError for DockErrorCode.None', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.None)).toBe(RvcOperationalState.ErrorState.NoError);
    });

    it('should return WaterTankEmpty for DockErrorCode.WaterEmpty', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.WaterEmpty)).toBe(
        RvcOperationalState.ErrorState.WaterTankEmpty,
      );
    });

    it('should return DustBinFull for DockErrorCode.DuctBlockage', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.DuctBlockage)).toBe(
        RvcOperationalState.ErrorState.DustBinFull,
      );
    });

    it('should return DirtyWaterTankFull for DockErrorCode.WasteWaterTankFull', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.WasteWaterTankFull)).toBe(
        RvcOperationalState.ErrorState.DirtyWaterTankFull,
      );
    });

    it('should return DirtyWaterTankFull for DockErrorCode.CleaningTankFullOrBlocked', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.CleaningTankFullOrBlocked)).toBe(
        RvcOperationalState.ErrorState.DirtyWaterTankFull,
      );
    });

    it('should return BrushJammed for DockErrorCode.MaintenanceBrushJammed', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.MaintenanceBrushJammed)).toBe(
        RvcOperationalState.ErrorState.BrushJammed,
      );
    });

    it('should return DirtyWaterTankMissing for DockErrorCode.DirtyTankLatchOpen', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.DirtyTankLatchOpen)).toBe(
        RvcOperationalState.ErrorState.DirtyWaterTankMissing,
      );
    });

    it('should return DustBinMissing for DockErrorCode.NoDustbin', () => {
      expect(DockStationStatus.parseDockErrorCode(DockErrorCode.NoDustbin)).toBe(
        RvcOperationalState.ErrorState.DustBinMissing,
      );
    });

    it('should return UnableToCompleteOperation for unknown error codes', () => {
      expect(DockStationStatus.parseDockErrorCode(999 as DockErrorCode)).toBe(
        RvcOperationalState.ErrorState.UnableToCompleteOperation,
      );
    });
  });
});
