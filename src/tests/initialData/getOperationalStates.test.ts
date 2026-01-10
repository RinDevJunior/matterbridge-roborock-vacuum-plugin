import { getOperationalErrorState, getErrorFromErrorCode, getErrorFromDSS } from '../../initialData/getOperationalStates.js';
import { VacuumErrorCode } from '../../roborockCommunication/Zenum/vacuumAndDockErrorCode.js';
import { DockingStationStatusType } from '../../model/DockingStationStatus.js';

describe('getOperationalStates', () => {
  test('getOperationalErrorState returns undefined for None and Error for others', () => {
    expect(getOperationalErrorState(VacuumErrorCode.None)).toBeUndefined();
    expect(getOperationalErrorState(VacuumErrorCode.Unknown || (999 as any))).toBeDefined();
  });

  test('getErrorFromErrorCode returns struct when error present', () => {
    const res = getErrorFromErrorCode(VacuumErrorCode.Unknown || (1 as any));
    expect(res).toBeDefined();
    expect(res?.errorStateDetails).toContain('Error code');
  });

  test('getErrorFromDSS handles undefined status', () => {
    const noStatus = getErrorFromDSS(undefined as any);
    expect(noStatus).toBeDefined();
    expect(noStatus?.errorStateLabel).toContain('No Docking Station Status');
  });

  test('getErrorFromDSS returns undefined when no errors present', () => {
    const status: any = {
      cleanFluidStatus: DockingStationStatusType.Normal,
      waterBoxFilterStatus: DockingStationStatusType.Normal,
      dustBagStatus: DockingStationStatusType.Normal,
      dirtyWaterBoxStatus: DockingStationStatusType.Normal,
      clearWaterBoxStatus: DockingStationStatusType.Normal,
      isUpdownWaterReady: DockingStationStatusType.Normal,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeUndefined();
  });

  test('getErrorFromDSS handles cleanFluidStatus error', () => {
    const status: any = {
      cleanFluidStatus: DockingStationStatusType.Error,
      waterBoxFilterStatus: 0,
      dustBagStatus: 0,
      dirtyWaterBoxStatus: 0,
      clearWaterBoxStatus: 0,
      isUpdownWaterReady: 0,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clean Fluid Error');
    expect(err?.errorStateDetails).toContain('clean fluid');
  });

  test('getErrorFromDSS handles waterBoxFilterStatus error', () => {
    const status: any = {
      cleanFluidStatus: 0,
      waterBoxFilterStatus: DockingStationStatusType.Error,
      dustBagStatus: 0,
      dirtyWaterBoxStatus: 0,
      clearWaterBoxStatus: 0,
      isUpdownWaterReady: 0,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Water Box Filter Error');
  });

  test('getErrorFromDSS handles dustBagStatus error', () => {
    const status: any = {
      cleanFluidStatus: 0,
      waterBoxFilterStatus: 0,
      dustBagStatus: DockingStationStatusType.Error,
      dirtyWaterBoxStatus: 0,
      clearWaterBoxStatus: 0,
      isUpdownWaterReady: 0,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dust Bag Error');
  });

  test('getErrorFromDSS handles dirtyWaterBoxStatus error', () => {
    const status: any = {
      cleanFluidStatus: 0,
      waterBoxFilterStatus: 0,
      dustBagStatus: 0,
      dirtyWaterBoxStatus: DockingStationStatusType.Error,
      clearWaterBoxStatus: 0,
      isUpdownWaterReady: 0,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Dirty Water Box Error');
  });

  test('getErrorFromDSS handles clearWaterBoxStatus error', () => {
    const status: any = {
      cleanFluidStatus: 0,
      waterBoxFilterStatus: 0,
      dustBagStatus: 0,
      dirtyWaterBoxStatus: 0,
      clearWaterBoxStatus: DockingStationStatusType.Error,
      isUpdownWaterReady: 0,
    };
    const err = getErrorFromDSS(status);
    expect(err).toBeDefined();
    expect(err?.errorStateLabel).toBe('Clear Water Box Error');
  });
});
