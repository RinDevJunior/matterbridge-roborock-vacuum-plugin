import { getDefaultSupportedRunModes, getDefaultSupportedCleanModes, getDefaultOperationalStates } from '../../../../behaviors/roborock.vacuum/default/initialData';
import { ExperimentalFeatureSetting } from '../../../../model/ExperimentalFeatureSetting';

describe('default initialData helpers', () => {
  test('getDefaultSupportedRunModes returns expected modes', () => {
    const modes = getDefaultSupportedRunModes();
    expect(Array.isArray(modes)).toBe(true);
    const labels = modes.map((m) => m.label);
    expect(labels).toEqual(expect.arrayContaining(['Idle', 'Cleaning', 'Mapping']));
  });

  test('getDefaultSupportedCleanModes without experimental feature does not include mode 99', () => {
    const modes = getDefaultSupportedCleanModes(undefined);
    const ids = modes.map((m) => m.mode);
    expect(ids).not.toContain(99);
  });

  test('getDefaultSupportedCleanModes with experimental feature includes mode 99', () => {
    const ef: ExperimentalFeatureSetting = { advancedFeature: { useVacationModeToSendVacuumToDock: true } } as any;
    const modes = getDefaultSupportedCleanModes(ef);
    const ids = modes.map((m) => m.mode);
    expect(ids).toContain(99);
  });

  test('getDefaultOperationalStates contains Error and Charging labels', () => {
    const states = getDefaultOperationalStates();
    const labels = states.map((s) => s.operationalStateLabel);
    expect(labels).toEqual(expect.arrayContaining(['Error', 'Charging']));
    const ids = states.map((s) => s.operationalStateId);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
