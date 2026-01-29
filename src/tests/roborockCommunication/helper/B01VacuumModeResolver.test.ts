import { describe, it, expect } from 'vitest';
import {
  resolveVacuumMode,
  resolveMopMode,
  resolveCleanRoute,
  resolveQ7CleanMode,
  resolveQ10CleanMode,
  resolveMopModeWithDistanceOff,
} from '../../../roborockCommunication/helper/B01VacuumModeResolver.js';

// Match the real values in ../../behaviors/roborock.vacuum/b01/q7.ts
const Q7VacuumSuctionPower = {
  Quiet: 101,
  Balanced: 102,
  Turbo: 103,
  Max: 104,
  Off: 105,
  Custom: 106,
  MaxPlus: 108,
};
const Q7MopWaterFlow = {
  Off: 200,
  Low: 201,
  Medium: 202,
  High: 203,
  Custom: 204,
  CustomizeWithDistanceOff: 207,
};
const Q7MopRoute = {
  Standard: 300,
  Deep: 301,
  Custom: 302,
  DeepPlus: 303,
  Fast: 304,
};

describe('B01VacuumModeResolver', () => {
  describe('resolveVacuumMode', () => {
    it('returns correct mode for each suctionPower', () => {
      expect(resolveVacuumMode(Q7VacuumSuctionPower.Quiet)).toBe(1);
      expect(resolveVacuumMode(Q7VacuumSuctionPower.Balanced)).toBe(2);
      expect(resolveVacuumMode(Q7VacuumSuctionPower.Turbo)).toBe(3);
      expect(resolveVacuumMode(Q7VacuumSuctionPower.Max)).toBe(4);
      expect(resolveVacuumMode(Q7VacuumSuctionPower.MaxPlus)).toBe(5);
      expect(resolveVacuumMode(Q7VacuumSuctionPower.Off)).toBe(0);
      expect(resolveVacuumMode(99)).toBe(0);
    });
  });

  describe('resolveMopMode', () => {
    it('returns correct mode for each waterFlow', () => {
      expect(resolveMopMode(Q7MopWaterFlow.High)).toBe(3);
      expect(resolveMopMode(Q7MopWaterFlow.Medium)).toBe(2);
      expect(resolveMopMode(Q7MopWaterFlow.Low)).toBe(1);
      expect(resolveMopMode(Q7MopWaterFlow.Off)).toBe(0);
      expect(resolveMopMode(99)).toBe(0);
    });
  });

  describe('resolveCleanRoute', () => {
    it('returns correct route for mopRoute', () => {
      expect(resolveCleanRoute(Q7MopRoute.Standard)).toBe(0);
      expect(resolveCleanRoute(Q7MopRoute.Deep)).toBe(1);
      expect(resolveCleanRoute(99)).toBe(0);
    });
  });

  describe('resolveQ7CleanMode', () => {
    it('returns 1 for vacuum+mop, 0 for vacuum only, 2 for mop only, 1 for neither', () => {
      expect(resolveQ7CleanMode(Q7VacuumSuctionPower.Balanced, Q7MopWaterFlow.Medium)).toBe(1); // both
      expect(resolveQ7CleanMode(Q7VacuumSuctionPower.Balanced, Q7MopWaterFlow.Off)).toBe(0); // vacuum only
      expect(resolveQ7CleanMode(Q7VacuumSuctionPower.Off, Q7MopWaterFlow.Medium)).toBe(2); // mop only
      expect(resolveQ7CleanMode(Q7VacuumSuctionPower.Off, Q7MopWaterFlow.Off)).toBe(1); // neither
    });
  });

  describe('resolveQ10CleanMode', () => {
    it('returns 1 for vacuum+mop, 2 for vacuum only, 3 for mop only, 1 for neither', () => {
      expect(resolveQ10CleanMode(1, 1)).toBe(1); // both
      expect(resolveQ10CleanMode(1, 0)).toBe(2); // vacuum only
      expect(resolveQ10CleanMode(0, 1)).toBe(3); // mop only
      expect(resolveQ10CleanMode(0, 0)).toBe(1); // neither
    });
  });

  describe('resolveMopModeWithDistanceOff', () => {
    it('returns 4 if distance_off > 0, else resolveMopMode', () => {
      expect(resolveMopModeWithDistanceOff(Q7MopWaterFlow.High, 5)).toBe(4);
      expect(resolveMopModeWithDistanceOff(Q7MopWaterFlow.High, 0)).toBe(3);
      expect(resolveMopModeWithDistanceOff(Q7MopWaterFlow.Off, 0)).toBe(0);
    });
  });
});
