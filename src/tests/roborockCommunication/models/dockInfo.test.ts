import { describe, it, expect } from 'vitest';
import { DockInfo } from '../../../roborockCommunication/models/dockInfo.js';
import { DockType } from '../../../roborockCommunication/enums/dockType.js';

describe('DockInfo', () => {
  it('can be instantiated with a DockType', () => {
    const info = new DockInfo(DockType.qrevo_curv_dock);
    expect(info).toBeDefined();
    expect(info).toBeInstanceOf(DockInfo);
  });
});
