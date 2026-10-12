import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	captureSessionSnapshot,
	captureSessionSnapshotFromResolved,
	maybeEmitOperationCompletion,
	type OperationSessionSnapshot,
	trackOperationSessionTiming,
} from '../../../runtimes/handlers/operationCompletionTracker.js';
import type { ResolvedState } from '../../../share/stateResolver.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(overrides: Partial<RoborockVacuumCleaner> = {}): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		getAttribute: vi.fn(),
		triggerEvent: vi.fn().mockResolvedValue(undefined),
		operationSessionStartMs: null,
		operationPausedSinceMs: null,
		operationPausedAccumMs: 0,
		...overrides,
	});
}

function createSnapshot(overrides: Partial<OperationSessionSnapshot> = {}): OperationSessionSnapshot {
	return {
		runMode: RvcRunMode.ModeTag.Idle,
		operationalState: RvcOperationalState.OperationalState.Stopped,
		errorStateId: RvcOperationalState.ErrorState.NoError,
		...overrides,
	};
}

describe('operationCompletionTracker', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		robot = createMockRobot();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe('captureSessionSnapshot', () => {
		it('should map a null currentMode to Idle run mode when mode is null', () => {
			// Arrange
			vi.mocked(robot.getAttribute).mockImplementation((_clusterId, attr) => {
				if (attr === 'currentMode') return null;
				if (attr === 'operationalState') return RvcOperationalState.OperationalState.Stopped;
				return undefined;
			});
			// Act
			const snapshot = captureSessionSnapshot(robot, mockLogger);
			// Assert
			expect(snapshot.runMode).toBe(RvcRunMode.ModeTag.Idle);
		});

		it('should default errorStateId to NoError when operationalError is undefined', () => {
			// Arrange
			vi.mocked(robot.getAttribute).mockImplementation((_clusterId, attr) => {
				if (attr === 'currentMode') return null;
				if (attr === 'operationalState') return RvcOperationalState.OperationalState.Running;
				return undefined;
			});
			// Act
			const snapshot = captureSessionSnapshot(robot, mockLogger);
			// Assert
			expect(snapshot.errorStateId).toBe(RvcOperationalState.ErrorState.NoError);
			expect(snapshot.operationalState).toBe(RvcOperationalState.OperationalState.Running);
		});
	});

	describe('captureSessionSnapshotFromResolved', () => {
		it('should default errorStateId to NoError when operationalError is undefined', () => {
			// Arrange
			const resolved = asPartial<ResolvedState>({
				runMode: RvcRunMode.ModeTag.Cleaning,
				operationalState: RvcOperationalState.OperationalState.Running,
				operationalError: undefined,
			});
			// Act
			const snapshot = captureSessionSnapshotFromResolved(resolved);
			// Assert
			expect(snapshot.errorStateId).toBe(RvcOperationalState.ErrorState.NoError);
			expect(snapshot.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
		});
	});

	describe('trackOperationSessionTiming', () => {
		it('should record the pause start time when transitioning from running to paused', () => {
			// Arrange
			vi.useFakeTimers();
			vi.setSystemTime(new Date(1_000_000));
			const before = createSnapshot({
				runMode: RvcRunMode.ModeTag.Cleaning,
				operationalState: RvcOperationalState.OperationalState.Running,
			});
			const after = createSnapshot({
				runMode: RvcRunMode.ModeTag.Cleaning,
				operationalState: RvcOperationalState.OperationalState.Paused,
			});
			// Act
			trackOperationSessionTiming(robot, before, after);
			// Assert
			expect(robot.operationPausedSinceMs).toBe(1_000_000);
		});
	});

	describe('maybeEmitOperationCompletion', () => {
		it('should log an error without rethrowing when triggerEvent rejects', async () => {
			// Arrange
			vi.mocked(robot.triggerEvent).mockRejectedValue(new Error('boom'));
			robot.operationSessionStartMs = Date.now();
			const before = createSnapshot({ runMode: RvcRunMode.ModeTag.Cleaning });
			const after = createSnapshot({ runMode: RvcRunMode.ModeTag.Idle });
			// Act
			const result = maybeEmitOperationCompletion(robot, before, after, mockLogger);
			// Assert
			await expect(result).resolves.toBeUndefined();
			expect(mockLogger.error).toHaveBeenCalledWith('Failed to emit operationCompletion event: Error: boom');
			expect(robot.operationSessionStartMs).toBeNull();
		});
	});
});
