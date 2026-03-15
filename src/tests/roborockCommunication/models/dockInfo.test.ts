import { describe, expect, it } from 'vitest';

import { DockType } from '../../../roborockCommunication/enums/dockType.js';
import { DockInfo } from '../../../roborockCommunication/models/dockInfo.js';

describe('DockInfo', () => {
	it('can be instantiated with a DockType', () => {
		const info = new DockInfo(DockType.qrevo_curv_dock);
		expect(info).toBeDefined();
		expect(info).toBeInstanceOf(DockInfo);
	});
});
