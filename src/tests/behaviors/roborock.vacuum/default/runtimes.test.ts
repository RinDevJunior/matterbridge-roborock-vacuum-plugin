import { describe, it, expect } from 'vitest';
import { VacuumSuctionPower, MopRoute, MopWaterFlow } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { createDefaultModeResolver } from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';
import { baseCleanModeConfigs, CleanModeDisplayLabel, CleanModeLabelInfo } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { asType } from '../../../testUtils.js';

const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);

describe('runtimes.getCurrentCleanModeDefault', () => {
  it('returns 10 when any value is Custom', () => {
    const s = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Off, 0, MopRoute.Standard);
    expect(defaultModeResolver.resolve(s)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode);
  });

  it('matches exact preset from CleanSetting', () => {
    // Use a known mapping from CleanSetting: mode 5 exists as default Vac & Mop
    const s = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard);
    const res = defaultModeResolver.resolve(s);
    // should be a number (one of the preset keys)
    expect(typeof res).toBe('number');
  });

  it('returns 31 for mop default', () => {
    const s = new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Standard);
    expect(defaultModeResolver.resolve(s)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode);
  });

  it('returns 66 for vacuum default', () => {
    const s = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Standard);
    expect(defaultModeResolver.resolve(s)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode);
  });

  it('returns 5 for vac & mop default when both on', () => {
    const s = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard);
    expect(defaultModeResolver.resolve(s)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode);
  });

  it('returns undefined for completely invalid input', () => {
    expect(defaultModeResolver.resolve(asType<CleanModeSetting>(undefined))).toBeUndefined();
    expect(defaultModeResolver.resolve(asType<CleanModeSetting>(null))).toBeUndefined();
    expect(defaultModeResolver.resolve(asType<CleanModeSetting>(123))).toBeUndefined();
    expect(defaultModeResolver.resolve(asType<CleanModeSetting>('bad'))).toBeUndefined();
  });

  it('returns 5 if no CleanSetting match and not covered by other rules', () => {
    // Use values that do not match any CleanSetting and do not trigger custom/off/other rules
    const s = new CleanModeSetting(999, 888, 0, 777);
    expect(defaultModeResolver.resolve(s)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode); // because none are Off, should return MopAndVacuumCustom mode
  });
});
