import { debugStringify } from 'matterbridge/logger';
import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

import { getRunningMode } from '../../initialData/getSupportedRunModes.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import { StatusChangeMessage } from '../../roborockCommunication/models/index.js';
import { getOperationalStateName, getRunModeName, getRunModeNameV2 } from '../../share/matterStateNames.js';
import { resolveDeviceState } from '../../share/stateResolver.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { triggerDssError } from '../handleLocalMessage.js';
import {
	captureSessionSnapshot,
	captureSessionSnapshotFromResolved,
	maybeEmitOperationCompletion,
	trackOperationSessionTiming,
} from './operationCompletionTracker.js';

export async function handleDeviceStatusUpdate(
	robot: RoborockVacuumCleaner,
	message: StatusChangeMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<boolean> {
	platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

	const includeDockStationStatus = platform.configManager.includeDockStationStatus;
	const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
	if (dssHasError) {
		await triggerDssError(robot, platform);
		return false;
	}

	const beforeSnapshot = captureSessionSnapshot(robot, platform.log);

	const currentRunMode: number = robot.getAttribute(RvcRunMode.id, 'currentMode');

	const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
		RvcOperationalState.id,
		'operationalState',
	);

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
		platform.log.debug(`Device is still charging, skipping Docked state update`);
		return false;
	}

	const updates = [
		robot.updateAttribute(RvcRunMode.id, 'currentMode', getRunningMode(resolvedState.runMode), platform.log),
		robot.updateAttribute(RvcOperationalState.id, 'operationalState', resolvedState.operationalState, platform.log),
	];

	if (resolvedState.operationalError !== undefined) {
		updates.push(
			robot.updateAttribute(
				RvcOperationalState.id,
				'operationalError',
				{ errorStateId: resolvedState.operationalError },
				platform.log,
			),
		);
	}

	await Promise.all(updates);

	const afterSnapshot = captureSessionSnapshotFromResolved(resolvedState);
	trackOperationSessionTiming(robot, beforeSnapshot, afterSnapshot);
	await maybeEmitOperationCompletion(robot, beforeSnapshot, afterSnapshot, platform.log);

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

	const includeDockStationStatus = platform.configManager.includeDockStationStatus;
	const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
	if (dssHasError) {
		await triggerDssError(robot, platform);
		return;
	}

	const beforeSnapshot = captureSessionSnapshot(robot, platform.log);

	const statusChangeMessage = new StatusChangeMessage(
		message.duid,
		message.status,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
	);

	const resolvedState = resolveDeviceState(statusChangeMessage);
	platform.log.debug(
		`Resolved state from simple update: runMode=${getRunModeName(resolvedState.runMode)}, operationalState=${getOperationalStateName(resolvedState.operationalState)}`,
	);

	const updates = [
		robot.updateAttribute(RvcRunMode.id, 'currentMode', getRunningMode(resolvedState.runMode), platform.log),
		robot.updateAttribute(RvcOperationalState.id, 'operationalState', resolvedState.operationalState, platform.log),
	];

	if (resolvedState.operationalError !== undefined) {
		updates.push(
			robot.updateAttribute(
				RvcOperationalState.id,
				'operationalError',
				{ errorStateId: resolvedState.operationalError },
				platform.log,
			),
		);
	}

	await Promise.all(updates);

	const afterSnapshot = captureSessionSnapshotFromResolved(resolvedState);
	trackOperationSessionTiming(robot, beforeSnapshot, afterSnapshot);
	await maybeEmitOperationCompletion(robot, beforeSnapshot, afterSnapshot, platform.log);
}
