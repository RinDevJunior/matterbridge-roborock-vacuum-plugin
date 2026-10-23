import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { OperationStatusCode } from '../../../roborockCommunication/enums/operationStatusCode.js';
import { BatteryMessage, type Device } from '../../../roborockCommunication/models/index.js';
import { handleBatteryUpdate } from '../../../runtimes/handlers/batteryStateHandler.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, asType, createMockLogger } from '../../helpers/testUtils.js';

// a306 (P30 Pro) strings from python-roborock tests/testdata/home_data_device_p30_pro.json.
// Carry the valley-electricity flag.
const A306_FEATURE_SET = '4499197267967999';
const A306_NEW_FEATURE_SET = '000002637C3FBF1DCEDD7FFDA8E8B6FD5BBFAF7F7EFEFFFF';
// Feature sets with no valley-electricity bit (a187 strings decode with the flag set, so not usable here).
const NO_VALLEY_FEATURE_SET = '0';
const NO_VALLEY_NEW_FEATURE_SET = '0';

describe('batteryStateHandler', () => {
	function createMockRobot(
		device: Partial<Device>,
		currentOperationState: RvcOperationalState.OperationalState = RvcOperationalState.OperationalState.Docked,
	) {
		return asPartial<RoborockVacuumCleaner>({
			device: asPartial<Device>(device),
			updateAttribute: vi.fn().mockResolvedValue(undefined),
			getAttribute: vi.fn().mockReturnValue(currentOperationState),
		});
	}

	function createMockPlatform() {
		return asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
		});
	}

	function batChargeStateCalls(robot: RoborockVacuumCleaner): unknown[] {
		return vi
			.mocked(robot.updateAttribute)
			.mock.calls.filter((call) => call[0] === PowerSource.id && call[1] === 'batChargeState')
			.map((call) => call[2]);
	}

	function operationalStateWrites(robot: RoborockVacuumCleaner): unknown[] {
		return vi
			.mocked(robot.updateAttribute)
			.mock.calls.filter((call) => call[0] === RvcOperationalState.id && call[1] === 'operationalState')
			.map((call) => call[2]);
	}

	let mockPlatform: ReturnType<typeof createMockPlatform>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockPlatform = createMockPlatform();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('handleBatteryUpdate off-peak charging', () => {
		it('should report IsNotCharging and not flip operationalState to Charging when a306 valley-waiting charge is reported', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, 0, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				PowerSource.id,
				'batChargeState',
				PowerSource.BatChargeState.IsNotCharging,
				mockPlatform.log,
			);
			expect(operationalStateWrites(robot)).not.toContain(RvcOperationalState.OperationalState.Charging);
		});

		it('should report IsCharging and flip Docked to Charging when a306 chargeStatus is Charging (1)', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, 1, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsCharging]);
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Charging,
				mockPlatform.log,
			);
		});

		it('should report IsCharging when device has no valley flag and reports chargeStatus 0', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: NO_VALLEY_FEATURE_SET, newFeatureSet: NO_VALLEY_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, 0, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsCharging]);
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Charging,
				mockPlatform.log,
			);
		});

		it('should report IsCharging when featureSet is undefined (B01-like device) and chargeStatus is 0', async () => {
			// Arrange
			const robot = createMockRobot({});
			const message = new BatteryMessage('duid', 50, 0, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsCharging]);
		});

		it('should report IsCharging when a306 chargeStatus is undefined', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, undefined, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsCharging]);
		});

		it('should report IsAtFullCharge and flip Charging to Docked when a306 battery is 100 with chargeStatus 0', async () => {
			// Arrange
			const robot = createMockRobot(
				{ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET },
				RvcOperationalState.OperationalState.Charging,
			);
			const message = new BatteryMessage('duid', 100, 0, OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsAtFullCharge]);
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Docked,
				mockPlatform.log,
			);
			expect(operationalStateWrites(robot)).not.toContain(RvcOperationalState.OperationalState.Charging);
		});

		it('should skip the batChargeState update when deviceStatus is undefined', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, 0, undefined);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toHaveLength(0);
			expect(robot.updateAttribute).toHaveBeenCalledWith(PowerSource.id, 'batPercentRemaining', 100, mockPlatform.log);
		});

		it('should report IsCharging when chargeStatus is the string "0" (strict comparison, not coerced)', async () => {
			// Arrange
			const robot = createMockRobot({ featureSet: A306_FEATURE_SET, newFeatureSet: A306_NEW_FEATURE_SET });
			const message = new BatteryMessage('duid', 50, asType<number>('0'), OperationStatusCode.Charging);

			// Act
			await handleBatteryUpdate(robot, message, mockPlatform);

			// Assert
			expect(batChargeStateCalls(robot)).toEqual([PowerSource.BatChargeState.IsCharging]);
		});
	});
});
