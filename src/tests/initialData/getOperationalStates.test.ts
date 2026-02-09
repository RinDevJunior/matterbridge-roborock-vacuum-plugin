import { describe, it, expect } from 'vitest';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getOperationalErrorState, getErrorFromErrorCode, getErrorFromDSS } from '../../initialData/getOperationalStates.js';
import { VacuumErrorCode } from '../../roborockCommunication/enums/vacuumAndDockErrorCode.js';
import { DockingStationStatusCode, DockingStationStatus } from '../../model/DockingStationStatus.js';
import { asType } from '../testUtils.js';

describe('getOperationalStates', () => {
  it('getOperationalErrorState returns undefined for None and Error for others', () => {
    expect(getOperationalErrorState(VacuumErrorCode.None)).toBeUndefined();
    expect(getOperationalErrorState(VacuumErrorCode.LidarBlocked)).toBeDefined();
  });

  it('getErrorFromErrorCode returns NoError for None', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.None)).toBe(RvcOperationalState.ErrorState.NoError);
  });

  it('getErrorFromErrorCode returns NavigationSensorObscured for sensor errors', () => {
    const sensorErrors = [
      VacuumErrorCode.LidarBlocked,
      VacuumErrorCode.CompassError,
      VacuumErrorCode.CliffSensorError,
      VacuumErrorCode.OpticalFlowSensorDirt,
      VacuumErrorCode.WallSensorDirty,
      VacuumErrorCode.CameraError,
      VacuumErrorCode.WallSensorError,
    ];
    for (const code of sensorErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.NavigationSensorObscured);
    }
  });

  it('getErrorFromErrorCode returns Stuck for physical obstruction errors', () => {
    const stuckErrors = [
      VacuumErrorCode.BumperStuck,
      VacuumErrorCode.RobotTrapped,
      VacuumErrorCode.RobotTilted,
      VacuumErrorCode.VerticalBumperPressed,
      VacuumErrorCode.VibrariseJammed,
      VacuumErrorCode.RobotOnCarpet,
    ];
    for (const code of stuckErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.Stuck);
    }
  });

  it('getErrorFromErrorCode returns WheelsJammed for wheel errors', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.WheelsSuspended)).toBe(RvcOperationalState.ErrorState.WheelsJammed);
    expect(getErrorFromErrorCode(VacuumErrorCode.WheelsJammed)).toBe(RvcOperationalState.ErrorState.WheelsJammed);
  });

  it('getErrorFromErrorCode returns BrushJammed for brush and roller errors', () => {
    const brushErrors = [
      VacuumErrorCode.MainBrushJammed,
      VacuumErrorCode.SideBrushJammed,
      VacuumErrorCode.SideBrushError,
      VacuumErrorCode.ClearBrushPositioningError,
      VacuumErrorCode.MoppingRollerJammed,
      VacuumErrorCode.MoppingRollerJammed2,
    ];
    for (const code of brushErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.BrushJammed);
    }
  });

  it('getErrorFromErrorCode returns DustBinMissing for dustbin errors', () => {
    const dustbinErrors = [VacuumErrorCode.NoDustbin, VacuumErrorCode.StrainerError, VacuumErrorCode.CleanAutoEmptyDock];
    for (const code of dustbinErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.DustBinMissing);
    }
  });

  it('getErrorFromErrorCode returns DustBinFull for clogged filter', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.FilterBlocked)).toBe(RvcOperationalState.ErrorState.DustBinFull);
  });

  it('getErrorFromErrorCode returns LowBattery only for low battery', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.LowBattery)).toBe(RvcOperationalState.ErrorState.LowBattery);
  });

  it('getErrorFromErrorCode returns UnableToStartOrResume for charging error', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.ChargingError)).toBe(RvcOperationalState.ErrorState.UnableToStartOrResume);
  });

  it('getErrorFromErrorCode returns FailedToFindChargingDock for dock errors', () => {
    const dockErrors = [VacuumErrorCode.DockNotConnectedToPower, VacuumErrorCode.ReturnToDockFail, VacuumErrorCode.DockLocatorError];
    for (const code of dockErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.FailedToFindChargingDock);
    }
  });

  it('getErrorFromErrorCode returns CannotReachTargetArea for zone errors', () => {
    const zoneErrors = [VacuumErrorCode.NogoZoneDetected, VacuumErrorCode.InvisibleWallDetected, VacuumErrorCode.CannotCrossCarpet];
    for (const code of zoneErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.CannotReachTargetArea);
    }
  });

  it('getErrorFromErrorCode returns UnableToCompleteOperation for system and hardware errors', () => {
    const systemErrors = [
      VacuumErrorCode.InternalError,
      VacuumErrorCode.TemperatureProtection,
      VacuumErrorCode.CleanCarouselException,
      VacuumErrorCode.FanError,
      VacuumErrorCode.BatteryError,
      VacuumErrorCode.AutoEmptyDockVoltage,
      VacuumErrorCode.AudioError,
      VacuumErrorCode.MoppingRollerNotLowered,
      VacuumErrorCode.SinkStrainerHoare,
      VacuumErrorCode.CheckCleanCarouse,
    ];
    for (const code of systemErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.UnableToCompleteOperation);
    }
  });

  it('getErrorFromErrorCode returns WaterTankEmpty for empty clean water tank', () => {
    expect(getErrorFromErrorCode(VacuumErrorCode.ClearWaterTankEmpty)).toBe(RvcOperationalState.ErrorState.WaterTankEmpty);
  });

  it('getErrorFromErrorCode returns WaterTankMissing for water tank issues', () => {
    const waterTankErrors = [
      VacuumErrorCode.ClearWaterBoxHoare,
      VacuumErrorCode.ClearBrushInstalledProperly,
      VacuumErrorCode.FilterScreenException,
      VacuumErrorCode.UpWaterException,
      VacuumErrorCode.WaterCarriageDrop,
    ];
    for (const code of waterTankErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.WaterTankMissing);
    }
  });

  it('getErrorFromErrorCode returns DirtyWaterTankFull for dirty water errors', () => {
    const dirtyWaterErrors = [VacuumErrorCode.DirtyWaterBoxHoare, VacuumErrorCode.DrainWaterException, VacuumErrorCode.CleanCarouselWaterFull];
    for (const code of dirtyWaterErrors) {
      expect(getErrorFromErrorCode(code)).toBe(RvcOperationalState.ErrorState.DirtyWaterTankFull);
    }
  });

  it('getErrorFromErrorCode returns NoError for unknown error codes', () => {
    expect(getErrorFromErrorCode(999 as VacuumErrorCode)).toBe(RvcOperationalState.ErrorState.NoError);
  });

  it('getErrorFromDSS handles undefined status', () => {
    const noStatus = getErrorFromDSS(asType<DockingStationStatus>(undefined));
    expect(noStatus).toBeDefined();
    expect(noStatus?.errorStateLabel).toContain('No Docking Station Status');
  });

  it('getErrorFromDSS returns undefined when no errors present', () => {
    const status = new DockingStationStatus(
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
    );
    const err = getErrorFromDSS(status);
    expect(err).toBeUndefined();
  });

  it('getErrorFromDSS handles cleanFluidStatus error', () => {
    const status = new DockingStationStatus(DockingStationStatusCode.Error, 0, 0, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clean Fluid Error');
    expect(err?.errorStateDetails).toContain('clean fluid');
  });

  it('getErrorFromDSS handles waterBoxFilterStatus error', () => {
    const status = new DockingStationStatus(0, DockingStationStatusCode.Error, 0, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Water Box Filter Error');
  });

  it('getErrorFromDSS handles dustBagStatus error', () => {
    const status = new DockingStationStatus(0, 0, DockingStationStatusCode.Error, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dust Bag Error');
  });

  it('getErrorFromDSS handles dirtyWaterBoxStatus error', () => {
    const status = new DockingStationStatus(0, 0, 0, DockingStationStatusCode.Error, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dirty Water Box Error');
  });

  it('getErrorFromDSS handles clearWaterBoxStatus error', () => {
    const status = new DockingStationStatus(0, 0, 0, 0, DockingStationStatusCode.Error, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clear Water Box Error');
  });
});
