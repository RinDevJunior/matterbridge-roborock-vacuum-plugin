import type { AnsiLogger } from 'matterbridge/logger';
import { OperationalState, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

import { baseRunModeConfigs } from '../../behaviors/roborock.vacuum/core/runModeConfig.js';
import type { ResolvedState } from '../../share/stateResolver.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export function isCleaningOrMappingRunMode(runMode: RvcRunMode.ModeTag): boolean {
	return runMode === RvcRunMode.ModeTag.Cleaning || runMode === RvcRunMode.ModeTag.Mapping;
}

export interface OperationSessionSnapshot {
	runMode: RvcRunMode.ModeTag;
	operationalState: RvcOperationalState.OperationalState;
	errorStateId: RvcOperationalState.ErrorState;
}

function modeNumberToTag(mode: number | null): RvcRunMode.ModeTag {
	if (mode === null) {
		return RvcRunMode.ModeTag.Idle;
	}
	const config = baseRunModeConfigs.find((entry) => entry.mode === mode);
	return config?.modeTags[0]?.value ?? RvcRunMode.ModeTag.Idle;
}

export function captureSessionSnapshot(robot: RoborockVacuumCleaner, log?: AnsiLogger): OperationSessionSnapshot {
	const currentMode = robot.getAttribute(RvcRunMode.id, 'currentMode', log) as number | null;
	const operationalError = robot.getAttribute(RvcOperationalState.id, 'operationalError', log) as
		| { errorStateId?: RvcOperationalState.ErrorState }
		| undefined;

	return {
		runMode: modeNumberToTag(currentMode),
		operationalState: robot.getAttribute(
			RvcOperationalState.id,
			'operationalState',
			log,
		) as RvcOperationalState.OperationalState,
		errorStateId: operationalError?.errorStateId ?? RvcOperationalState.ErrorState.NoError,
	};
}

export function captureSessionSnapshotFromResolved(resolvedState: ResolvedState): OperationSessionSnapshot {
	return {
		runMode: resolvedState.runMode,
		operationalState: resolvedState.operationalState,
		errorStateId: resolvedState.operationalError ?? RvcOperationalState.ErrorState.NoError,
	};
}

export function trackOperationSessionTiming(
	robot: RoborockVacuumCleaner,
	before: OperationSessionSnapshot,
	after: OperationSessionSnapshot,
): void {
	if (isCleaningOrMappingRunMode(after.runMode) && robot.operationSessionStartMs === null) {
		robot.operationSessionStartMs = Date.now();
	}

	const wasPaused = before.operationalState === RvcOperationalState.OperationalState.Paused;
	const isPaused = after.operationalState === RvcOperationalState.OperationalState.Paused;

	if (!wasPaused && isPaused) {
		robot.operationPausedSinceMs = Date.now();
	} else if (wasPaused && !isPaused && robot.operationPausedSinceMs !== null) {
		robot.operationPausedAccumMs += Date.now() - robot.operationPausedSinceMs;
		robot.operationPausedSinceMs = null;
	}
}

export async function maybeEmitOperationCompletion(
	robot: RoborockVacuumCleaner,
	before: OperationSessionSnapshot,
	after: OperationSessionSnapshot,
	log: AnsiLogger,
): Promise<void> {
	if (!isCleaningOrMappingRunMode(before.runMode) || isCleaningOrMappingRunMode(after.runMode)) {
		return;
	}

	if (robot.operationSessionStartMs === null) {
		return;
	}

	if (robot.operationPausedSinceMs !== null) {
		robot.operationPausedAccumMs += Date.now() - robot.operationPausedSinceMs;
		robot.operationPausedSinceMs = null;
	}

	const elapsedMs = Date.now() - robot.operationSessionStartMs;
	const elapsedSeconds = Math.round(elapsedMs / 1000);
	const elapsedPausedSeconds =
		robot.operationPausedAccumMs > 0 ? Math.round(robot.operationPausedAccumMs / 1000) : null;

	const payload: OperationalState.OperationCompletionEvent = {
		completionErrorCode: after.errorStateId,
		totalOperationalTime: elapsedSeconds,
		pausedTime: elapsedPausedSeconds,
	};

	try {
		await robot.triggerEvent(RvcOperationalState, 'operationCompletion', payload, log);
	} catch (error) {
		log.error(`Failed to emit operationCompletion event: ${String(error)}`);
	}

	robot.operationSessionStartMs = null;
	robot.operationPausedAccumMs = 0;
}
