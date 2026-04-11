import { debugStringify } from 'matterbridge/logger';
import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';

import { getBatteryState, getBatteryStatus } from '../../initialData/index.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import type { BatteryMessage } from '../../roborockCommunication/models/index.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export async function handleBatteryUpdate(
	robot: RoborockVacuumCleaner,
	message: BatteryMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	platform.log.debug(`Handling battery update: ${debugStringify(message)}`);
	const batteryLevel = message.percentage;
	const deviceStatus = message.deviceStatus;
	const batteryChargeLevel = getBatteryStatus(batteryLevel);

	if (batteryLevel != null) {
		await Promise.all([
			robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log),
			robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', batteryChargeLevel, platform.log),
		]);
	}

	if (batteryLevel != null && deviceStatus) {
		const batteryChargeState = getBatteryState(deviceStatus, batteryLevel);
		await robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', batteryChargeState, platform.log);

		const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
			RvcOperationalState.Cluster.id,
			'operationalState',
			platform.log,
		);
		if (
			batteryChargeState === PowerSource.BatChargeState.IsCharging &&
			currentOperationState === RvcOperationalState.OperationalState.Docked
		) {
			await robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalState',
				RvcOperationalState.OperationalState.Charging,
				platform.log,
			);
		}

		if (
			batteryChargeState === PowerSource.BatChargeState.IsAtFullCharge &&
			currentOperationState === RvcOperationalState.OperationalState.Charging
		) {
			await robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalState',
				RvcOperationalState.OperationalState.Docked,
				platform.log,
			);
		}
	}
}
