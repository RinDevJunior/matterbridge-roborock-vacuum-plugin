import { debugStringify } from 'matterbridge/logger';
import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

import { getRunningMode } from '../../initialData/getSupportedRunModes.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import type { StatusChangeMessage } from '../../roborockCommunication/models/index.js';
import { state_to_matter_operational_status, state_to_matter_state } from '../../share/function.js';
import { getOperationalStateName, getRunModeName, getRunModeNameV2 } from '../../share/matterStateNames.js';
import { resolveDeviceState } from '../../share/stateResolver.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { triggerDssError } from '../handleLocalMessage.js';

export async function handleDeviceStatusUpdate(
	robot: RoborockVacuumCleaner,
	message: StatusChangeMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<boolean> {
	platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

	// Check docking station errors before state resolution
	const includeDockStationStatus = platform.configManager.includeDockStationStatus;
	const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
	if (dssHasError) {
		await triggerDssError(robot, platform);
		return false;
	}

	const currentRunMode: number = robot.getAttribute(RvcRunMode.Cluster.id, 'currentMode');

	const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
		RvcOperationalState.Cluster.id,
		'operationalState',
	);

	// Resolve state using state resolution matrix
	const resolvedState = resolveDeviceState(message);

	platform.log.notice(
		`[${robot.device.duid}] [${robot.device.name}] Resolved state:
      currentRunMode=${getRunModeNameV2(currentRunMode)}, code=${currentRunMode}
      currentOperationState=${getOperationalStateName(currentOperationState)}, code=${currentOperationState}
      newRunMode=${getRunModeName(resolvedState.runMode)}, code=${getRunningMode(resolvedState.runMode)}
      newOperationalState=${getOperationalStateName(resolvedState.operationalState)}, code=${resolvedState.operationalState}`,
	);

	if (
		currentOperationState === RvcOperationalState.OperationalState.Charging &&
		resolvedState.runMode === RvcRunMode.ModeTag.Idle &&
		resolvedState.operationalState === RvcOperationalState.OperationalState.Docked
	) {
		// Device is still charging; skip Docked update and let handleBatteryUpdate transition away from Charging when battery is full.
		platform.log.debug(`Device is still charging, skipping Docked state update`);
		return false;
	}

	// Update Matter attributes
	await Promise.all([
		robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(resolvedState.runMode), platform.log),
		robot.updateAttribute(
			RvcOperationalState.Cluster.id,
			'operationalState',
			resolvedState.operationalState,
			platform.log,
		),
	]);

	// Signal burst polling when the device enters an active state
	const isActive =
		resolvedState.runMode === RvcRunMode.ModeTag.Cleaning || resolvedState.runMode === RvcRunMode.ModeTag.Mapping;
	return isActive;
}

export async function handleDeviceStatusSimpleUpdate(
	robot: RoborockVacuumCleaner,
	message: { duid: string; status: OperationStatusCode },
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	platform.log.debug(`Handling simple device status update: ${debugStringify(message)}`);

	const state = state_to_matter_state(message.status);
	platform.log.debug(`Resolved state from simple update: ${state !== undefined ? getRunModeName(state) : 'undefined'}`);
	if (state !== undefined) {
		await robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), platform.log);
	}

	const includeDockStationStatus = platform.configManager.includeDockStationStatus;
	const operationalStateId = state_to_matter_operational_status(state);
	const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
	if (dssHasError) {
		await triggerDssError(robot, platform);
		return;
	}
	if (operationalStateId !== undefined) {
		platform.log.debug(`Updating operational state to: ${getOperationalStateName(operationalStateId)}`);
		await robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
	}
}
