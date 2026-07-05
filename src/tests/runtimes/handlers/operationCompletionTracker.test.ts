import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	captureSessionSnapshot,
	isCleaningOrMappingRunMode,
	maybeEmitOperationCompletion,
	type OperationSessionSnapshot,
	trackOperationSessionTiming,
} from '../../../runtimes/handlers/operationCompletionTracker.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(overrides: Partial<RoborockVacuumCleaner> = {}): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		operationSessionStartMs: null,
		operationPausedSinceMs: null,
		operationPausedAccumMs: 0,
		getAttribute: vi.fn(),
		triggerEvent: vi.fn().mockResolvedValue(true),
		...overrides,
	});
}

function cleaningSnapshot(overrides: Partial<OperationSessionSnapshot> = {}): OperationSessionSnapshot {
	return {
		runMode: RvcRunMode.ModeTag.Cleaning,
		operationalState: RvcOperationalState.OperationalState.Running,
		errorStateId: RvcOperationalState.ErrorState.NoError,
		...overrides,
	};
}

function idleSnapshot(overrides: Partial<OperationSessionSnapshot> = {}): OperationSessionSnapshot {
	return {
		runMode: RvcRunMode.ModeTag.Idle,
		operationalState: RvcOperationalState.OperationalState.Docked,
		errorStateId: RvcOperationalState.ErrorState.NoError,
		...overrides,
	};
}

describe('operationCompletionTracker', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('isCleaningOrMappingRunMode', () => {
		it('should return true when runMode is Cleaning or Mapping', () => {
			expect(isCleaningOrMappingRunMode(RvcRunMode.ModeTag.Cleaning)).toBe(true);
			expect(isCleaningOrMappingRunMode(RvcRunMode.ModeTag.Mapping)).toBe(true);
		});

		it('should return false when runMode is Idle', () => {
			expect(isCleaningOrMappingRunMode(RvcRunMode.ModeTag.Idle)).toBe(false);
		});
	});

	describe('maybeEmitOperationCompletion', () => {
		it('should emit operationCompletion when runMode transitions Cleaning to Idle with session start set', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-05T12:00:30.000Z'));

			const robot = createMockRobot({ operationSessionStartMs: new Date('2026-07-05T12:00:00.000Z').getTime() });

			await maybeEmitOperationCompletion(robot, cleaningSnapshot(), idleSnapshot(), mockLogger);

			expect(robot.triggerEvent).toHaveBeenCalledWith(
				RvcOperationalState,
				'operationCompletion',
				{
					completionErrorCode: RvcOperationalState.ErrorState.NoError,
					totalOperationalTime: 30,
					pausedTime: null,
				},
				mockLogger,
			);
			expect(robot.operationSessionStartMs).toBeNull();
			expect(robot.operationPausedAccumMs).toBe(0);
		});

		it('should not emit when session start is null', async () => {
			const robot = createMockRobot({ operationSessionStartMs: null });

			await maybeEmitOperationCompletion(robot, cleaningSnapshot(), idleSnapshot(), mockLogger);

			expect(robot.triggerEvent).not.toHaveBeenCalled();
		});

		it('should not emit on Idle to Idle churn', async () => {
			const robot = createMockRobot({
				operationSessionStartMs: Date.now(),
			});

			await maybeEmitOperationCompletion(robot, idleSnapshot(), idleSnapshot(), mockLogger);

			expect(robot.triggerEvent).not.toHaveBeenCalled();
		});

		it('should not emit on Docked to Docked churn', async () => {
			const robot = createMockRobot({
				operationSessionStartMs: Date.now(),
			});
			const dockedSnapshot = idleSnapshot({
				operationalState: RvcOperationalState.OperationalState.Docked,
			});

			await maybeEmitOperationCompletion(robot, dockedSnapshot, dockedSnapshot, mockLogger);

			expect(robot.triggerEvent).not.toHaveBeenCalled();
		});

		it('should include error code when transitioning to Error operational state with active session', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-05T12:00:10.000Z'));

			const robot = createMockRobot({ operationSessionStartMs: new Date('2026-07-05T12:00:00.000Z').getTime() });

			await maybeEmitOperationCompletion(
				robot,
				cleaningSnapshot(),
				idleSnapshot({
					operationalState: RvcOperationalState.OperationalState.Error,
					errorStateId: RvcOperationalState.ErrorState.Stuck,
				}),
				mockLogger,
			);

			expect(robot.triggerEvent).toHaveBeenCalledWith(
				RvcOperationalState,
				'operationCompletion',
				expect.objectContaining({
					completionErrorCode: RvcOperationalState.ErrorState.Stuck,
					totalOperationalTime: 10,
				}),
				mockLogger,
			);
		});

		it('should populate pausedTime when pause intervals were recorded', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-05T12:01:00.000Z'));

			const robot = createMockRobot({
				operationSessionStartMs: new Date('2026-07-05T12:00:00.000Z').getTime(),
				operationPausedAccumMs: 15_000,
			});

			await maybeEmitOperationCompletion(robot, cleaningSnapshot(), idleSnapshot(), mockLogger);

			expect(robot.triggerEvent).toHaveBeenCalledWith(
				RvcOperationalState,
				'operationCompletion',
				expect.objectContaining({
					totalOperationalTime: 60,
					pausedTime: 15,
				}),
				mockLogger,
			);
		});
	});

	describe('trackOperationSessionTiming', () => {
		it('should accumulate pause time when leaving Paused operational state', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-05T12:00:20.000Z'));

			const robot = createMockRobot({
				operationSessionStartMs: new Date('2026-07-05T12:00:00.000Z').getTime(),
				operationPausedSinceMs: new Date('2026-07-05T12:00:05.000Z').getTime(),
			});

			trackOperationSessionTiming(
				robot,
				cleaningSnapshot({ operationalState: RvcOperationalState.OperationalState.Paused }),
				cleaningSnapshot({ operationalState: RvcOperationalState.OperationalState.Running }),
			);

			expect(robot.operationPausedAccumMs).toBe(15_000);
			expect(robot.operationPausedSinceMs).toBeNull();
		});
	});

	describe('captureSessionSnapshot', () => {
		it('should map currentMode number to runMode tag', () => {
			const robot = createMockRobot({
				getAttribute: vi.fn((_clusterId: number, attribute: string): unknown => {
					if (attribute === 'currentMode') {
						return 2;
					}
					if (attribute === 'operationalState') {
						return RvcOperationalState.OperationalState.Running;
					}
					if (attribute === 'operationalError') {
						return { errorStateId: RvcOperationalState.ErrorState.NoError };
					}
					return undefined;
				}) as RoborockVacuumCleaner['getAttribute'],
			});

			const snapshot = captureSessionSnapshot(robot, mockLogger);

			expect(snapshot.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
			expect(snapshot.operationalState).toBe(RvcOperationalState.OperationalState.Running);
		});
	});
});
