import { describe, it, expect } from 'vitest';
import { resolveDeviceState } from '../../share/stateResolver.js';
import { StatusChangeMessage } from '../../roborockCommunication/models/deviceStatus.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import { RvcRunMode, RvcOperationalState } from 'matterbridge/matter/clusters';

describe('resolveDeviceState - 56-row State Resolution Matrix', () => {
  describe('Priority 0: Status Override Rules (Highest Priority)', () => {
    describe('Idle Status Override - Row 11', () => {
      it('should ignore all flags and return Idle/Docked', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Idle, true, true, true, true, true, true);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });
    });

    describe('EmptyingDustContainer Status Override - Row 53', () => {
      it('should ignore all flags and return Cleaning/EmptyingDustBin (real data: 02:09:03)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.EmptyingDustContainer, true, false, false, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.EmptyingDustBin);
      });
    });

    describe('WashingTheMop Status Override - Row 54', () => {
      it('should ignore all flags and return Cleaning/CleaningMop (real data: 01:01:04)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
      });
    });

    describe('GoingToWashTheMop Status Override - Row 55', () => {
      it('should ignore all flags and return Cleaning/CleaningMop (real data: 01:13:04)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.GoingToWashTheMop, true, true, false, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
      });
    });

    describe('Mapping Status Override - Row 56', () => {
      it('should ignore all flags and return Mapping/Running', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Mapping, true, true, true, true, true, true);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });
    });
  });

  describe('Priority 1: Cleaning Status Special Overrides', () => {
    describe('Cleaning + inWarmup Override - Row 13', () => {
      it('should ignore all other flags and return Cleaning/CleaningMop (real data: 01:50:03)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, true);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
      });

      it('should override inReturning when inWarmup is true', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, true, undefined, undefined, undefined, true);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
      });
    });

    describe('Cleaning + isLocating Override - Row 14', () => {
      it('should ignore all other flags except inWarmup/inReturning and return Cleaning/UpdatingMaps', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, true, true, true, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.UpdatingMaps);
      });
    });

    describe('Cleaning + isExploring Override - Row 15', () => {
      it('should ignore all other flags except inWarmup/inReturning and return Cleaning/UpdatingMaps', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, true, false, true, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.UpdatingMaps);
      });
    });
  });

  describe('Priority 2: Modifier Priority Chain', () => {
    describe('Base State Resolution - Row 12', () => {
      it('should return base state when no modifiers are active (real data: 01:03:04)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });

      it('should return base state when all flags are undefined (REST API)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });
    });

    describe('Priority 2a: inReturning Modifier (High Priority)', () => {
      it('should override to SeekingCharger for ReturningDock status - Row 21 (real data: 02:05:03)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.ReturningDock, true, true, false, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should override to SeekingCharger for Cleaning status - Row 16', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, true, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should override isExploring when both are true - Row 17', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, true, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should override inFreshState when both are true - Row 18', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, true, true, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should override all modifiers when inReturning is true - Row 19', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, true, true, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should maintain Paused state when status is Paused - Row 33', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Paused, undefined, true, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Paused);
      });

      it('should work for Charging status - Row 27', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, undefined, true, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });
    });

    describe('Priority 2b: isExploring Modifier (Medium Priority)', () => {
      it('should change runMode to Mapping for ManualMode - Row 25', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.ManualMode, undefined, undefined, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });

      it('should change runMode to Mapping for ReturningDock - Row 22', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.ReturningDock, undefined, undefined, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should change runMode to Mapping for Paused - Row 40', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Paused, undefined, undefined, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Paused);
      });

      it('should be blocked when status is Charging (invalid state)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, undefined, undefined, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });

      it('should be blocked when status is Paused (10) with explicit false flags - Row 34', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Paused, undefined, false, false, false, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Paused);
      });
    });

    describe('Priority 2c: inFreshState Modifier (Low Priority)', () => {
      it('should transition to Idle/Docked when status is Charging - Row 28 (real data: 01:00:04, 02:10:03)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, false, false, true, false, false, false);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });

      it('should be ignored when status is Cleaning (invalid state removed)', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, undefined, undefined, true, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });

      it('should be overridden by inReturning - Row 30', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, undefined, true, true, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should be overridden by both inReturning and isExploring - Row 31', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, undefined, true, true, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });
    });
  });

  describe('Edge Cases and Unknown Status Codes', () => {
    describe('Unknown Status - Rows 1-4', () => {
      it('should fallback to Idle/Docked for unknown status - Row 1', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Unknown, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });

      it('should apply inReturning for unknown status - Row 2', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Unknown, undefined, true, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
      });

      it('should apply isExploring for unknown status - Row 3', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Unknown, undefined, undefined, undefined, undefined, true, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });
    });

    describe('Other Status Codes', () => {
      it('should handle Initiating status - Row 5', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Initiating, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });

      it('should handle Sleeping status - Row 8', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.Sleeping, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
      });

      it('should handle ChargingError status - Row 35', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.ChargingError, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Error);
      });

      it('should handle ZoneClean status - Row 41', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.ZoneClean, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });

      it('should handle RoomClean status - Row 44', () => {
        const message = new StatusChangeMessage('test-duid', OperationStatusCode.RoomClean, undefined, undefined, undefined, undefined, undefined, undefined);

        const result = resolveDeviceState(message);

        expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
        expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
      });
    });
  });

  describe('Real Cleaning Process Data', () => {
    it('should handle initial idle state (01:00:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, false, false, true, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
    });

    it('should handle pre-cleaning mop wash (01:01:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle active cleaning (01:03:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle mid-cleaning return to wash (01:13:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.GoingToWashTheMop, true, true, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle warmup phase (01:50:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, true);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final return to dock (02:05:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.ReturningDock, true, true, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
    });

    it('should handle drying phase (02:09:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.EmptyingDustContainer, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.EmptyingDustBin);
    });

    it('should handle pre-cleaning wash phase 2 (01:02:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle active cleaning phase 2 (01:04:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle active cleaning phase 3 (01:12:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle mid-cleaning wash phase 1 (01:14:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle mid-cleaning wash phase 2 (01:15:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle mid-cleaning wash phase 3 (01:16:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle active cleaning phase 4 (01:17:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle active cleaning phase 5 (01:18:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle active cleaning phase 6 (01:25:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle mid-cleaning return to wash 2 (01:26:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.GoingToWashTheMop, true, true, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle mid-cleaning wash phase 4 (01:27:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle mid-cleaning wash phase 5 (01:28:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle mid-cleaning wash phase 6 (01:29:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle active cleaning phase 7 (01:30:04)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle active cleaning phase 8 (01:46:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle final wash phase 1 (01:47:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final wash phase 2 (01:48:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final wash phase 3 (01:49:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle active cleaning phase 9 (01:51:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle active cleaning phase 10 (02:04:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Cleaning, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Running);
    });

    it('should handle final wash phase 4 (02:06:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final wash phase 5 (02:07:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final wash phase 6 (02:08:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.WashingTheMop, true, false, false, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
    });

    it('should handle final idle state (02:10:03)', () => {
      const message = new StatusChangeMessage('test-duid', OperationStatusCode.Charging, false, false, true, false, false, false);

      const result = resolveDeviceState(message);

      expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
      expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
    });
  });
});
