import { describe, it, expect } from 'vitest';
import { DockInfo } from '@/roborockCommunication/Zmodel/dockInfo.js';
import { DockType } from '@/roborockCommunication/Zenum/dockType.js';

describe('DockInfo', () => {
  it('can be instantiated with a DockType', () => {
    const info = new DockInfo(DockType.qrevo_curv_dock);
    expect(info).toBeDefined();
    expect(info).toBeInstanceOf(DockInfo);
  });
});
