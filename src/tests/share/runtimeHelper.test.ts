import { getCurrentCleanModeFunc } from '../../share/runtimeHelper';
import { getCurrentCleanModeDefault } from '../../behaviors/roborock.vacuum/default/runtimes';
import { getCurrentCleanModeSmart } from '../../behaviors/roborock.vacuum/smart/runtimes';
import { DeviceModel } from '../../roborockCommunication/Zmodel/deviceModel';

describe('runtimeHelper.getCurrentCleanModeFunc', () => {
  test('forceRunAtDefault returns default function', () => {
    const fn = getCurrentCleanModeFunc(DeviceModel.Q5, true);
    expect(fn).toBe(getCurrentCleanModeDefault);
  });

  test('QREVO models return smart function when not forced', () => {
    const fn1 = getCurrentCleanModeFunc(DeviceModel.QREVO_EDGE_5V1, false);
    const fn2 = getCurrentCleanModeFunc(DeviceModel.QREVO_PLUS, false);
    expect(fn1).toBe(getCurrentCleanModeSmart);
    expect(fn2).toBe(getCurrentCleanModeSmart);
  });

  test('other models return default function when not forced', () => {
    const fn = getCurrentCleanModeFunc(DeviceModel.S7_MAXV, false);
    expect(fn).toBe(getCurrentCleanModeDefault);
  });
});
