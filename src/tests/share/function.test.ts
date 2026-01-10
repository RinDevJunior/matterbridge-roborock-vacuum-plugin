import { state_to_matter_state, state_to_matter_operational_status } from '../../share/function';
import { OperationStatusCode } from '../../roborockCommunication/Zenum/operationStatusCode';
import { RvcRunMode, RvcOperationalState } from 'matterbridge/matter/clusters';

describe('share/function helpers', () => {
  describe('state_to_matter_state', () => {
    test('returns undefined for null state', () => {
      const result = state_to_matter_state(null as any);
      expect(result).toBeUndefined();
    });

    test('returns Cleaning for cleaning-related states', () => {
      expect(state_to_matter_state(OperationStatusCode.Cleaning)).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(state_to_matter_state(OperationStatusCode.SpotCleaning)).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(state_to_matter_state(OperationStatusCode.ZoneClean)).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(state_to_matter_state(OperationStatusCode.RoomClean)).toBe(RvcRunMode.ModeTag.Cleaning);
    });

    test('returns Mapping for mapping state', () => {
      expect(state_to_matter_state(OperationStatusCode.Mapping)).toBe(RvcRunMode.ModeTag.Mapping);
    });

    test('returns Idle for idle-related states', () => {
      expect(state_to_matter_state(OperationStatusCode.Idle)).toBe(RvcRunMode.ModeTag.Idle);
      expect(state_to_matter_state(OperationStatusCode.Sleeping)).toBe(RvcRunMode.ModeTag.Idle);
      expect(state_to_matter_state(OperationStatusCode.Charging)).toBe(RvcRunMode.ModeTag.Idle);
      expect(state_to_matter_state(OperationStatusCode.FullyCharged)).toBe(RvcRunMode.ModeTag.Idle);
    });

    test('returns Idle for undefined (default)', () => {
      expect(state_to_matter_state(undefined)).toBe(RvcRunMode.ModeTag.Idle);
      expect(state_to_matter_state(99999)).toBe(RvcRunMode.ModeTag.Idle);
    });
  });

  describe('state_to_matter_operational_status', () => {
    test('returns Running for cleaning/mapping states', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.Cleaning)).toBe(RvcOperationalState.OperationalState.Running);
      expect(state_to_matter_operational_status(OperationStatusCode.Mapping)).toBe(RvcOperationalState.OperationalState.Running);
      expect(state_to_matter_operational_status(OperationStatusCode.RoomClean)).toBe(RvcOperationalState.OperationalState.Running);
    });

    test('returns Error for error states', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.InError)).toBe(RvcOperationalState.OperationalState.Error);
      expect(state_to_matter_operational_status(OperationStatusCode.ChargingError)).toBe(RvcOperationalState.OperationalState.Error);
      expect(state_to_matter_operational_status(OperationStatusCode.Unknown)).toBe(RvcOperationalState.OperationalState.Error);
    });

    test('returns Paused for paused state', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.Paused)).toBe(RvcOperationalState.OperationalState.Paused);
    });

    test('returns Stopped for shutting down', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.ShuttingDown)).toBe(RvcOperationalState.OperationalState.Stopped);
    });

    test('returns SeekingCharger for docking-related states', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.ReturnToDock)).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      expect(state_to_matter_operational_status(OperationStatusCode.ReturningDock)).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      expect(state_to_matter_operational_status(OperationStatusCode.EmptyingDustContainer)).toBe(RvcOperationalState.OperationalState.SeekingCharger);
    });

    test('returns Docked for idle/charging states (default)', () => {
      expect(state_to_matter_operational_status(OperationStatusCode.Idle)).toBe(RvcOperationalState.OperationalState.Docked);
      expect(state_to_matter_operational_status(OperationStatusCode.Sleeping)).toBe(RvcOperationalState.OperationalState.Docked);
      expect(state_to_matter_operational_status(OperationStatusCode.Charging)).toBe(RvcOperationalState.OperationalState.Docked);
      expect(state_to_matter_operational_status(undefined)).toBe(RvcOperationalState.OperationalState.Docked);
    });
  });
});
