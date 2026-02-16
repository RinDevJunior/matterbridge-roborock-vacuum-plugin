import { describe, it, expect } from 'vitest';
import { getSettingFromCleanMode } from '../../../../behaviors/roborock.vacuum/core/cleanModeUtils.js';
import { CleanModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { createDefaultCleanModeSettings, type CleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';

describe('cleanModeUtils', () => {
  describe('getSettingFromCleanMode', () => {
    it('should return undefined for unknown activity', () => {
      expect(getSettingFromCleanMode('Unknown Mode')).toBeUndefined();
    });

    it('should return MopDefault settings with defaults when no cleanModeSettings provided', () => {
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault);
      expect(result).toBeDefined();
      expect(result?.suctionPower).toBe(VacuumSuctionPower.Off);
      expect(result?.waterFlow).toBe(MopWaterFlow.Medium);
      expect(result?.distance_off).toBe(0);
      expect(result?.mopRoute).toBe(MopRoute.Standard);
      expect(result?.sequenceType).toBe(CleanSequenceType.Persist);
    });

    it('should return VacuumDefault settings with defaults when no cleanModeSettings provided', () => {
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.VacuumDefault);
      expect(result).toBeDefined();
      expect(result?.suctionPower).toBe(VacuumSuctionPower.Balanced);
      expect(result?.waterFlow).toBe(MopWaterFlow.Off);
      expect(result?.distance_off).toBe(0);
      expect(result?.mopRoute).toBe(MopRoute.Standard);
      expect(result?.sequenceType).toBe(CleanSequenceType.Persist);
    });

    it('should return MopAndVacuumDefault settings with defaults when no cleanModeSettings provided', () => {
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopAndVacuumDefault);
      expect(result).toBeDefined();
      expect(result?.suctionPower).toBe(VacuumSuctionPower.Balanced);
      expect(result?.waterFlow).toBe(MopWaterFlow.Medium);
      expect(result?.distance_off).toBe(0);
      expect(result?.mopRoute).toBe(MopRoute.Standard);
      expect(result?.sequenceType).toBe(CleanSequenceType.Persist);
    });

    it('should use custom mopping settings when provided', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        mopping: { waterFlowMode: 'Low', mopRouteMode: 'Fast', distanceOff: 25 },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);
      expect(result).toBeDefined();
      expect(result?.waterFlow).toBe(MopWaterFlow.Low);
      expect(result?.mopRoute).toBe(MopRoute.Fast);
    });

    it('should use custom vacuuming settings when provided', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        vacuuming: { fanMode: 'Max', mopRouteMode: 'Fast' },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.VacuumDefault, settings);
      expect(result).toBeDefined();
      expect(result?.suctionPower).toBe(VacuumSuctionPower.Max);
      expect(result?.mopRoute).toBe(MopRoute.Fast);
    });

    it('should use custom vacmop settings when provided', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        vacmop: { fanMode: 'Max', waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 25 },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopAndVacuumDefault, settings);
      expect(result).toBeDefined();
      expect(result?.suctionPower).toBe(VacuumSuctionPower.Max);
      expect(result?.waterFlow).toBe(MopWaterFlow.High);
      expect(result?.mopRoute).toBe(MopRoute.Fast);
    });

    it('should calculate distance_off for CustomizeWithDistanceOff water flow in MopDefault', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Standard', distanceOff: 30 },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);
      expect(result).toBeDefined();
      expect(result?.waterFlow).toBe(MopWaterFlow.CustomizeWithDistanceOff);
      expect(result?.distance_off).toBe(210 - 5 * 30);
    });

    it('should use default distanceOff when not provided for CustomizeWithDistanceOff', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Standard', distanceOff: undefined as unknown as number },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);
      expect(result).toBeDefined();
      expect(result?.distance_off).toBe(210 - 5 * 25);
    });

    it('should calculate distance_off for CustomizeWithDistanceOff water flow in MopAndVacuumDefault', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        vacmop: { fanMode: 'Balanced', waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Standard', distanceOff: 20 },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopAndVacuumDefault, settings);
      expect(result).toBeDefined();
      expect(result?.waterFlow).toBe(MopWaterFlow.CustomizeWithDistanceOff);
      expect(result?.distance_off).toBe(210 - 5 * 20);
    });

    it('should fallback to defaults for invalid enum string values', () => {
      const settings: CleanModeSettings = {
        ...createDefaultCleanModeSettings(),
        mopping: { waterFlowMode: 'InvalidMode', mopRouteMode: 'InvalidRoute', distanceOff: 25 },
      };
      const result = getSettingFromCleanMode(CleanModeDisplayLabel.MopDefault, settings);
      expect(result).toBeDefined();
      expect(result?.waterFlow).toBe(MopWaterFlow.Medium);
      expect(result?.mopRoute).toBe(MopRoute.Standard);
    });
  });
});
