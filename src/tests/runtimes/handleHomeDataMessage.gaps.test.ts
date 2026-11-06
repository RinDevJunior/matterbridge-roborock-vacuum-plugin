import type { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WATCHDOG_THRESHOLD_MS } from '../../constants/index.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { Device, DeviceSpecs, Home, Product } from '../../roborockCommunication/models/index.js';
import { updateFromHomeData } from '../../runtimes/handleHomeDataMessage.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

const DUID = 'duid-1';

function createRobot(
	model: string,
	hasRealTimeConnection: boolean,
	lastUpdateAt: number | null,
): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		lastUpdateAt,
		device: asPartial<Device>({
			duid: DUID,
			specs: asPartial<DeviceSpecs>({ model: model as DeviceSpecs['model'], hasRealTimeConnection }),
		}),
	});
}

function createDevice(productId: string, model: string, deviceStatus: Device['deviceStatus'] = {}): Device {
	return asPartial<Device>({
		duid: DUID,
		productId,
		schema: [],
		deviceStatus,
		specs: asPartial<DeviceSpecs>({ model: model as DeviceSpecs['model'] }),
	});
}

function createPlatform(robot: RoborockVacuumCleaner) {
	const updateRobotWithPayload = vi.fn().mockResolvedValue(undefined);
	const robotsMap = new Map<string, RoborockVacuumCleaner>([[DUID, robot]]);
	const registry = asPartial<DeviceRegistry>({
		get robotsMap() {
			return robotsMap;
		},
		getRobot: vi.fn().mockReturnValue(robot),
	});
	const platform = asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger() as AnsiLogger,
		registry,
		platformRunner: asPartial<RoborockMatterbridgePlatform['platformRunner']>({ updateRobotWithPayload }),
	});
	return { platform, updateRobotWithPayload };
}

describe('updateFromHomeData (gaps)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('product schema matching', () => {
		const productSchema = asType<Device['schema']>([{ marker: 'matched' }]);
		const product = asPartial<Product>({ id: 'prod-match', model: 'model-match', schema: productSchema });

		it.each([
			{
				label: 'productId equals product id',
				productId: 'prod-match',
				deviceModel: 'other.device',
				robotModel: 'other.robot',
				expected: productSchema,
			},
			{
				label: 'robot model equals product model',
				productId: 'prod-other',
				deviceModel: 'other.device',
				robotModel: 'model-match',
				expected: productSchema,
			},
			{
				label: 'device model equals product model',
				productId: 'prod-other',
				deviceModel: 'model-match',
				robotModel: 'other.robot',
				expected: productSchema,
			},
			{
				label: 'no product field matches',
				productId: 'prod-other',
				deviceModel: 'other.device',
				robotModel: 'other.robot',
				expected: [],
			},
		])('should assign schema when $label', async ({ productId, deviceModel, robotModel, expected }) => {
			// Arrange
			const robot = createRobot(robotModel, false, null);
			const { platform } = createPlatform(robot);
			const device = createDevice(productId, deviceModel);
			const homeData = asPartial<Home>({ products: [product], devices: [device], receivedDevices: [] });
			// Act
			await updateFromHomeData(homeData, platform);
			// Assert
			expect(device.schema).toEqual(expected);
		});
	});

	describe('device status refresh gating', () => {
		const NOW = new Date('2026-10-12T00:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(NOW);
		});

		afterEach(() => {
			vi.clearAllTimers();
			vi.useRealTimers();
		});

		it.each([
			{
				label: 'real-time connection is up but the last update is stale',
				hasRealTimeConnection: true,
				lastUpdateAt: NOW.getTime() - WATCHDOG_THRESHOLD_MS - 1,
				shouldUpdate: true,
			},
			{
				label: 'real-time connection is up but no update was ever received',
				hasRealTimeConnection: true,
				lastUpdateAt: null,
				shouldUpdate: true,
			},
			{
				label: 'real-time connection is up and the last update is fresh',
				hasRealTimeConnection: true,
				lastUpdateAt: NOW.getTime(),
				shouldUpdate: false,
			},
			{
				label: 'real-time connection is down even though the last update is fresh',
				hasRealTimeConnection: false,
				lastUpdateAt: NOW.getTime(),
				shouldUpdate: true,
			},
		])(
			'should update status: $shouldUpdate when $label',
			async ({ hasRealTimeConnection, lastUpdateAt, shouldUpdate }) => {
				// Arrange
				const robot = createRobot('roborock.vacuum.s7', hasRealTimeConnection, lastUpdateAt);
				const { platform, updateRobotWithPayload } = createPlatform(robot);
				const device = createDevice('prod-1', 'roborock.vacuum.s7', { state: 5 });
				const homeData = asPartial<Home>({ products: [], devices: [device], receivedDevices: [] });
				const expectedCalls = shouldUpdate
					? [[{ type: NotifyMessageTypes.DeviceStatusSimple, data: { duid: DUID, status: 5 } }]]
					: [];
				// Act
				await updateFromHomeData(homeData, platform);
				// Assert
				expect(updateRobotWithPayload.mock.calls).toEqual(expectedCalls);
			},
		);
	});
});
