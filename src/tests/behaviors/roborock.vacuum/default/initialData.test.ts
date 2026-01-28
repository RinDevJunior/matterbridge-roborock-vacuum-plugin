import { describe, it, expect } from 'vitest';
import { getDefaultSupportedRunModes, getDefaultSupportedCleanModes, getDefaultOperationalStates } from '../../../../behaviors/roborock.vacuum/default/initialData.js';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { PlatformConfigManager } from '../../../../platform/platformConfig.js';

describe('default initialData helpers', () => {
  it('getDefaultSupportedRunModes returns expected modes', () => {
    const modes = getDefaultSupportedRunModes();
    expect(Array.isArray(modes)).toBe(true);
    const labels = modes.map((m) => m.label);
    expect(labels).toEqual(expect.arrayContaining(['Idle', 'Cleaning', 'Mapping']));
  });

  it('getDefaultSupportedCleanModes with experimental feature includes mode 99', () => {
    const ef: PlatformConfigManager = { useVacationModeToSendVacuumToDock: true } as any;
    const modes = getDefaultSupportedCleanModes(ef);
    const ids = modes.map((m) => m.mode);
    expect(ids).toContain(99);
  });

  it('getDefaultOperationalStates contains Error and Charging labels', () => {
    const states = getDefaultOperationalStates();
    const labels = states.map((s) => s.operationalStateId);
    expect(labels).toEqual(
      expect.arrayContaining([
        RvcOperationalState.OperationalState.Stopped,
        RvcOperationalState.OperationalState.Running,
        RvcOperationalState.OperationalState.Paused,
        RvcOperationalState.OperationalState.Error,
        RvcOperationalState.OperationalState.SeekingCharger,
        RvcOperationalState.OperationalState.Charging,
        RvcOperationalState.OperationalState.Docked,
      ]),
    );
    const ids = states.map((s) => s.operationalStateId);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
