import { describe, expect, it, vi } from 'vitest';

import { BehaviorDeviceGeneric, CommandNames } from '../behaviors/BehaviorDeviceGeneric.js';
import { RunModeDisplayLabel, RunModeLabelInfo } from '../behaviors/roborock.vacuum/core/runModeConfig.js';
import { CleanModeSettings } from '../model/RoborockPluginPlatformConfig.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { RoborockService } from '../services/roborockService.js';
import { configureBehavior } from '../share/behaviorFactory.js';
import { asPartial, createMockLogger } from './helpers/testUtils.js';

describe('configureBehavior', () => {
	const duid = 'test-duid';
	const cleanModeSettings: CleanModeSettings = {} as CleanModeSettings;
	const roborockService = {} as RoborockService;
	const logger = createMockLogger();
	const onActionTriggered = vi.fn();

	it('returns smart handler for smart model', () => {
		const result = configureBehavior(
			DeviceModel.QREVO_EDGE_5V1,
			duid,
			roborockService,
			false,
			cleanModeSettings,
			false,
			logger,
			onActionTriggered,
		);
		expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
	});

	it('returns default handler for non-smart model', () => {
		const result = configureBehavior(
			'non-smart-model',
			duid,
			roborockService,
			false,
			cleanModeSettings,
			false,
			logger,
			onActionTriggered,
		);
		expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
	});

	it('returns default handler if forceRunAtDefault is true, even for smart model', () => {
		const result = configureBehavior(
			DeviceModel.QREVO_EDGE_5V1,
			duid,
			roborockService,
			false,
			cleanModeSettings,
			true,
			logger,
			onActionTriggered,
		);
		expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
	});

	describe('CHANGE_TO_MODE onCleaningStart wiring', () => {
		function createRoborockServiceMock(): RoborockService {
			return asPartial<RoborockService>({
				setProgress: vi.fn(),
				startClean: vi.fn().mockResolvedValue(undefined),
				pauseClean: vi.fn().mockResolvedValue(undefined),
			});
		}

		it('should invoke onCleaningStart once and onActionTriggered when changing to the Cleaning run mode', async () => {
			// Arrange
			const service = createRoborockServiceMock();
			const onCleaningStart = vi.fn();
			const onAction = vi.fn();
			const result = configureBehavior(
				'non-smart-model',
				duid,
				service,
				false,
				cleanModeSettings,
				false,
				logger,
				onAction,
				undefined,
				undefined,
				onCleaningStart,
			);

			// Act
			await result.executeCommand(CommandNames.CHANGE_TO_MODE, RunModeLabelInfo[RunModeDisplayLabel.Cleaning].mode);

			// Assert
			expect(service.startClean).toHaveBeenCalledWith(duid);
			expect(onCleaningStart).toHaveBeenCalledTimes(1);
			expect(onAction).toHaveBeenCalledTimes(1);
		});

		it('should not invoke onCleaningStart when changing to the Idle run mode', async () => {
			// Arrange
			const service = createRoborockServiceMock();
			const onCleaningStart = vi.fn();
			const result = configureBehavior(
				'non-smart-model',
				duid,
				service,
				false,
				cleanModeSettings,
				false,
				logger,
				onActionTriggered,
				undefined,
				undefined,
				onCleaningStart,
			);

			// Act
			await result.executeCommand(CommandNames.CHANGE_TO_MODE, RunModeLabelInfo[RunModeDisplayLabel.Idle].mode);

			// Assert
			expect(service.pauseClean).toHaveBeenCalledWith(duid);
			expect(onCleaningStart).not.toHaveBeenCalled();
		});

		it('should still start cleaning when no onCleaningStart is passed', async () => {
			// Arrange
			const service = createRoborockServiceMock();
			const onAction = vi.fn();
			const result = configureBehavior(
				'non-smart-model',
				duid,
				service,
				false,
				cleanModeSettings,
				false,
				logger,
				onAction,
			);

			// Act
			await result.executeCommand(CommandNames.CHANGE_TO_MODE, RunModeLabelInfo[RunModeDisplayLabel.Cleaning].mode);

			// Assert
			expect(service.startClean).toHaveBeenCalledWith(duid);
			expect(onAction).toHaveBeenCalledTimes(1);
		});
	});
});
