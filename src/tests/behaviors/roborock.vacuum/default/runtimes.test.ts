import { describe, it, expect } from 'vitest';
import { VacuumSuctionPower, MopRoute, MopWaterFlow } from '../../../../behaviors/roborock.vacuum/default/default.js';
import { createDefaultModeResolver } from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';
import { baseCleanModeConfigs } from '../../../../behaviors/roborock.vacuum/core/modeConfig.js';

const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);

describe('runtimes.getCurrentCleanModeDefault', () => {
  it('returns 10 when any value is Custom', () => {
    const s = { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Standard } as any;
    expect(defaultModeResolver.resolve(s)).toBe(10);
  });

  it('matches exact preset from CleanSetting', () => {
    // Use a known mapping from CleanSetting: mode 5 exists as default Vac & Mop
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    const res = defaultModeResolver.resolve(s);
    // should be a number (one of the preset keys)
    expect(typeof res).toBe('number');
  });

  it('returns 31 for mop default', () => {
    const s = { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    expect(defaultModeResolver.resolve(s)).toBe(31);
  });

  it('returns 66 for vacuum default', () => {
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Standard } as any;
    expect(defaultModeResolver.resolve(s)).toBe(66);
  });

  it('returns 5 for vac & mop default when both on', () => {
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    expect(defaultModeResolver.resolve(s)).toBe(5);
  });

  it('returns undefined for completely invalid input', () => {
    expect(defaultModeResolver.resolve(undefined as any)).toBeUndefined();
    expect(defaultModeResolver.resolve(null as any)).toBeUndefined();
    expect(defaultModeResolver.resolve(123 as any)).toBeUndefined();
    expect(defaultModeResolver.resolve('bad' as any)).toBeUndefined();
  });

  it('returns 5 if no CleanSetting match and not covered by other rules', () => {
    // Use values that do not match any CleanSetting and do not trigger custom/off/other rules
    const s = { suctionPower: 999, waterFlow: 888, mopRoute: 777 } as any;
    expect(defaultModeResolver.resolve(s)).toBe(5);
  });
});
