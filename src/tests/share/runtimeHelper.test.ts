import { describe, expect, it } from 'vitest';

import {
	baseCleanModeConfigs,
	smartCleanModeConfigs,
} from '../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import {
	createDefaultModeResolver,
	createSmartModeResolver,
} from '../../behaviors/roborock.vacuum/core/modeResolver.js';
import { DeviceModel } from '../../roborockCommunication/models/index.js';
import { getCleanModeResolver } from '../../share/runtimeHelper.js';

const smartModeResolver = createSmartModeResolver(smartCleanModeConfigs);
const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);

describe('runtimeHelper.getCurrentCleanModeFunc', () => {
	it('forceRunAtDefault returns default function', () => {
		const resolver = getCleanModeResolver(DeviceModel.Q5, true);
		expect(resolver.behavior).toBe(defaultModeResolver.behavior);
	});

	it('QREVO models return smart function when not forced', () => {
		const resolver1 = getCleanModeResolver(DeviceModel.QREVO_EDGE_5V1, false);
		const resolver2 = getCleanModeResolver(DeviceModel.QREVO_PLUS, false);
		expect(resolver1.behavior).toBe(smartModeResolver.behavior);
		expect(resolver2.behavior).toBe(smartModeResolver.behavior);
	});

	it('other models return default function when not forced', () => {
		const resolver = getCleanModeResolver(DeviceModel.S7_MAXV, false);
		expect(resolver.behavior).toBe(defaultModeResolver.behavior);
	});
});
