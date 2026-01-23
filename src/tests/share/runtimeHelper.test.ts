import { describe, it, expect } from 'vitest';
import { getCurrentCleanModeFunc } from '../../share/runtimeHelper.js';
import { getCurrentCleanModeDefault } from '../../behaviors/roborock.vacuum/default/runtimes.js';
import { getCurrentCleanModeSmart } from '../../behaviors/roborock.vacuum/smart/runtimes.js';
import { DeviceModel } from '../../roborockCommunication/models/index.js';

describe('runtimeHelper.getCurrentCleanModeFunc', () => {
  it('forceRunAtDefault returns default function', () => {
    const fn = getCurrentCleanModeFunc(DeviceModel.Q5, true);
    expect(fn).toBe(getCurrentCleanModeDefault);
  });

  it('QREVO models return smart function when not forced', () => {
    const fn1 = getCurrentCleanModeFunc(DeviceModel.QREVO_EDGE_5V1, false);
    const fn2 = getCurrentCleanModeFunc(DeviceModel.QREVO_PLUS, false);
    expect(fn1).toBe(getCurrentCleanModeSmart);
    expect(fn2).toBe(getCurrentCleanModeSmart);
  });

  it('other models return default function when not forced', () => {
    const fn = getCurrentCleanModeFunc(DeviceModel.S7_MAXV, false);
    expect(fn).toBe(getCurrentCleanModeDefault);
  });
});
