import { describe, it, expect } from 'vitest';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getOperationalErrorState, getErrorFromDSS } from '../../initialData/getOperationalStates.js';
import { VacuumErrorCode } from '../../roborockCommunication/enums/vacuumAndDockErrorCode.js';
import { DockStationStatusCode, DockStationStatus } from '../../model/DockStationStatus.js';
import { VacuumStatus } from '../../model/VacuumStatus.js';
import { asType } from '../testUtils.js';

describe('getOperationalStates', () => {
  it('getOperationalErrorState returns undefined for None and Error for others', () => {
    expect(getOperationalErrorState(VacuumErrorCode.None)).toBeUndefined();
    expect(getOperationalErrorState(VacuumErrorCode.LidarBlocked)).toBeDefined();
  });

  it('getErrorFromErrorCode returns NoError for None', () => {
    const vacuumStatus = new VacuumStatus(VacuumErrorCode.None);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.NoError);
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
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.NavigationSensorObscured);
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
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.Stuck);
    }
  });

  it('getErrorFromErrorCode returns WheelsJammed for wheel errors', () => {
    const vacuumStatus1 = new VacuumStatus(VacuumErrorCode.WheelsSuspended);
    expect(vacuumStatus1.getErrorState()).toBe(RvcOperationalState.ErrorState.WheelsJammed);
    const vacuumStatus2 = new VacuumStatus(VacuumErrorCode.WheelsJammed);
    expect(vacuumStatus2.getErrorState()).toBe(RvcOperationalState.ErrorState.WheelsJammed);
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
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.BrushJammed);
    }
  });

  it('getErrorFromErrorCode returns DustBinMissing for dustbin errors', () => {
    const dustbinErrors = [
      VacuumErrorCode.NoDustbin,
      VacuumErrorCode.StrainerError,
      VacuumErrorCode.CleanAutoEmptyDock,
    ];
    for (const code of dustbinErrors) {
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.DustBinMissing);
    }
  });

  it('getErrorFromErrorCode returns DustBinFull for clogged filter', () => {
    const vacuumStatus = new VacuumStatus(VacuumErrorCode.FilterBlocked);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.DustBinFull);
  });

  it('getErrorFromErrorCode returns LowBattery only for low battery', () => {
    const vacuumStatus = new VacuumStatus(VacuumErrorCode.LowBattery);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.LowBattery);
  });

  it('getErrorFromErrorCode returns UnableToStartOrResume for charging error', () => {
    const vacuumStatus = new VacuumStatus(VacuumErrorCode.ChargingError);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.UnableToStartOrResume);
  });

  it('getErrorFromErrorCode returns FailedToFindChargingDock for dock errors', () => {
    const dockErrors = [
      VacuumErrorCode.DockNotConnectedToPower,
      VacuumErrorCode.ReturnToDockFail,
      VacuumErrorCode.DockLocatorError,
    ];
    for (const code of dockErrors) {
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.FailedToFindChargingDock);
    }
  });

  it('getErrorFromErrorCode returns CannotReachTargetArea for zone errors', () => {
    const zoneErrors = [
      VacuumErrorCode.NogoZoneDetected,
      VacuumErrorCode.InvisibleWallDetected,
      VacuumErrorCode.CannotCrossCarpet,
    ];
    for (const code of zoneErrors) {
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.CannotReachTargetArea);
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
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.UnableToCompleteOperation);
    }
  });

  it('getErrorFromErrorCode returns WaterTankEmpty for empty clean water tank', () => {
    const vacuumStatus = new VacuumStatus(VacuumErrorCode.ClearWaterTankEmpty);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.WaterTankEmpty);
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
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.WaterTankMissing);
    }
  });

  it('getErrorFromErrorCode returns DirtyWaterTankFull for dirty water errors', () => {
    const dirtyWaterErrors = [
      VacuumErrorCode.DirtyWaterBoxHoare,
      VacuumErrorCode.DrainWaterException,
      VacuumErrorCode.CleanCarouselWaterFull,
    ];
    for (const code of dirtyWaterErrors) {
      const vacuumStatus = new VacuumStatus(code);
      expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.DirtyWaterTankFull);
    }
  });

  it('getErrorFromErrorCode returns NoError for unknown error codes', () => {
    const vacuumStatus = new VacuumStatus(999 as VacuumErrorCode);
    expect(vacuumStatus.getErrorState()).toBe(RvcOperationalState.ErrorState.NoError);
  });

  it('getErrorFromDSS handles undefined status', () => {
    const noStatus = getErrorFromDSS(asType<DockStationStatus>(undefined));
    expect(noStatus).toBeDefined();
    expect(noStatus?.errorStateLabel).toContain('No Docking Station Status');
  });

  it('getErrorFromDSS returns undefined when no errors present', () => {
    const status = new DockStationStatus(
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
    );
    const err = getErrorFromDSS(status);
    expect(err).toBeUndefined();
  });

  it('getErrorFromDSS handles cleanFluidStatus error', () => {
    const status = new DockStationStatus(DockStationStatusCode.Error, 0, 0, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clean Fluid Error');
    expect(err?.errorStateDetails).toContain('clean fluid');
  });

  it('getErrorFromDSS handles waterBoxFilterStatus error', () => {
    const status = new DockStationStatus(0, DockStationStatusCode.Error, 0, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Water Box Filter Error');
  });

  it('getErrorFromDSS handles dustBagStatus error', () => {
    const status = new DockStationStatus(0, 0, DockStationStatusCode.Error, 0, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dust Bag Error');
  });

  it('getErrorFromDSS handles dirtyWaterBoxStatus error', () => {
    const status = new DockStationStatus(0, 0, 0, DockStationStatusCode.Error, 0, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dirty Water Box Error');
  });

  it('getErrorFromDSS handles clearWaterBoxStatus error', () => {
    const status = new DockStationStatus(0, 0, 0, 0, DockStationStatusCode.Error, 0);
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clear Water Box Error');
  });
});
