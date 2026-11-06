import type { CommandHandlerPayload } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandNames } from '../../behaviors/BehaviorDeviceGeneric.js';
import { MapInfo } from '../../core/application/models/MapInfo.js';
import { RoomMap } from '../../core/application/models/RoomMap.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import {
	AdvancedFeatureConfiguration,
	AdvancedFeatureSetting,
	createDefaultAdvancedFeature,
	PluginConfiguration,
	RoborockPluginPlatformConfig,
} from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { type Device, DeviceModel } from '../../roborockCommunication/models/index.js';
import type { RoborockService } from '../../services/roborockService.js';
import type { BehaviorFactoryResult } from '../../share/behaviorFactory.js';
import { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

const REMOTE_CONTEXT = {
	fabric: 1,
	subject: { kind: 'node', id: 0xe0dceafen },
	session: { id: 0xc914, peerNodeId: 0xe0dceafen, fabric: { label: 'Apple Home' } },
};
const REMOTE_SENDER_LINE = 'fabric 1 "Apple Home", peer node 0xe0dceafe, session 0xc914';

function createMockDevice(): Device {
	return asPartial<Device>({
		duid: 'duid-sender',
		pv: '1.0',
		specs: asPartial<Device['specs']>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
		serialNumber: 'serial-sender',
		name: 'SenderVac',
		scenes: [],
	});
}

function createConfigManager(enableFilterMonitoring: boolean): PlatformConfigManager {
	return PlatformConfigManager.create(
		asPartial<RoborockPluginPlatformConfig>({
			pluginConfiguration: asPartial<PluginConfiguration>({ enableMultipleMap: false, enableServerMode: false }),
			advancedFeature: asPartial<AdvancedFeatureConfiguration>({
				enableAdvancedFeature: true,
				settings: asPartial<AdvancedFeatureSetting>({
					...createDefaultAdvancedFeature().settings,
					enableFilterMonitoring,
				}),
			}),
		}),
		createMockLogger(),
	);
}

function createRoborockService(): RoborockService {
	return asPartial<RoborockService>({
		setSupportedRoutines: vi.fn(),
		setSupportedAreas: vi.fn(),
		setSupportedAreaIndexMap: vi.fn(),
		getSupportedAreas: vi.fn().mockReturnValue([]),
		getProgress: vi.fn().mockReturnValue([]),
		setProgress: vi.fn(),
		switchMap: vi.fn().mockResolvedValue(undefined),
	});
}

describe('RoborockVacuumCleaner command sender logging', () => {
	let logger: AnsiLogger;
	let behaviorHandler: BehaviorFactoryResult;

	function buildVacuum(enableFilterMonitoring = false): RoborockVacuumCleaner {
		const homeInfo = new HomeEntity(1, 'Sender Home', new RoomMap([]), MapInfo.empty(), 0);
		const vacuum = new RoborockVacuumCleaner(
			createMockDevice(),
			homeInfo,
			createConfigManager(enableFilterMonitoring),
			createRoborockService(),
			logger,
		);
		vi.spyOn(vacuum.log, 'info').mockImplementation(() => {});
		vi.spyOn(vacuum.log, 'error').mockImplementation(() => {});
		vi.spyOn(vacuum, 'addCommandHandler');
		return vacuum;
	}

	function getHandler(vacuum: RoborockVacuumCleaner, name: string): (payload: CommandHandlerPayload) => Promise<void> {
		const registered = vi.mocked(vacuum.addCommandHandler).mock.calls.find(([commandName]) => commandName === name);
		if (!registered) throw new Error(`Handler not registered: ${name}`);
		return asType<(payload: CommandHandlerPayload) => Promise<void>>(registered[1]);
	}

	function buildPayload(command: string, request: Record<string, unknown>, context: unknown): CommandHandlerPayload {
		return asType<CommandHandlerPayload>({
			command,
			request,
			cluster: 'cluster',
			attributes: {},
			endpoint: 'endpoint',
			context,
		});
	}

	function senderLines(vacuumLog: AnsiLogger): string[] {
		return vi
			.mocked(vacuumLog.info)
			.mock.calls.map(([message]) => message)
			.filter((message) => / command from /.test(message));
	}

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		behaviorHandler = asPartial<BehaviorFactoryResult>({
			executeCommand: vi.fn().mockResolvedValue(undefined),
			setCommandHandler: vi.fn(),
			log: logger,
			commands: {},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should log the goHome sender line and still execute goHome exactly once when invoked with a remote context', async () => {
		// Arrange
		const vacuum = buildVacuum();
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, CommandNames.GO_HOME);
		const payload = buildPayload(CommandNames.GO_HOME, {}, REMOTE_CONTEXT);

		// Act
		await handler(payload);

		// Assert
		expect(vacuum.log.info).toHaveBeenCalledWith(`goHome command from ${REMOTE_SENDER_LINE}`);
		expect(vacuum.log.info).toHaveBeenCalledWith('GoHome command received');
		expect(behaviorHandler.executeCommand).toHaveBeenCalledTimes(1);
		expect(behaviorHandler.executeCommand).toHaveBeenCalledWith(CommandNames.GO_HOME);
	});

	it.each([
		{ name: 'identify', request: {}, executeArgs: [CommandNames.IDENTIFY, 5] },
		{ name: 'selectAreas', request: { newAreas: [1] }, executeArgs: [CommandNames.SELECT_AREAS, [1]] },
		{ name: 'skipArea', request: { skippedArea: 2 }, executeArgs: [CommandNames.SKIP_AREA, 2] },
		{ name: 'changeToMode', request: { newMode: 3 }, executeArgs: [CommandNames.CHANGE_TO_MODE, 3] },
		{ name: 'pause', request: {}, executeArgs: [CommandNames.PAUSE] },
		{ name: 'resume', request: {}, executeArgs: [CommandNames.RESUME] },
		{ name: 'goHome', request: {}, executeArgs: [CommandNames.GO_HOME] },
		{ name: 'stop', request: {}, executeArgs: [CommandNames.STOP] },
	])('should log exactly one sender line when $name is invoked', async ({ name, request, executeArgs }) => {
		// Arrange
		const vacuum = buildVacuum();
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, name);
		const payload = buildPayload(name, request, REMOTE_CONTEXT);

		// Act
		await handler(payload);

		// Assert
		expect(senderLines(vacuum.log)).toEqual([`${name} command from ${REMOTE_SENDER_LINE}`]);
		expect(behaviorHandler.executeCommand).toHaveBeenCalledWith(...executeArgs);
	});

	it('should log the local sender label and still execute the command when invoked without a context', async () => {
		// Arrange
		const vacuum = buildVacuum();
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, CommandNames.PAUSE);
		const payload = buildPayload(CommandNames.PAUSE, {}, undefined);

		// Act
		await handler(payload);

		// Assert
		expect(vacuum.log.info).toHaveBeenCalledWith('pause command from local (no remote session)');
		expect(behaviorHandler.executeCommand).toHaveBeenCalledWith(CommandNames.PAUSE);
	});

	it('should log the unknown sender label and still execute the command when the context getter throws', async () => {
		// Arrange
		const vacuum = buildVacuum();
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, CommandNames.RESUME);
		const hostileContext = {
			get fabric(): number {
				throw new Error('hostile');
			},
		};
		const payload = buildPayload(CommandNames.RESUME, {}, hostileContext);

		// Act
		const act = handler(payload);

		// Assert
		await expect(act).resolves.toBeUndefined();
		expect(vacuum.log.info).toHaveBeenCalledWith('resume command from unknown sender');
		expect(behaviorHandler.executeCommand).toHaveBeenCalledWith(CommandNames.RESUME);
	});

	it('should log the error, rethrow it, and keep the sender line when the underlying command throws', async () => {
		// Arrange
		const vacuum = buildVacuum();
		vi.mocked(behaviorHandler.executeCommand).mockRejectedValue(new Error('skip failed'));
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, CommandNames.SKIP_AREA);
		const payload = buildPayload(CommandNames.SKIP_AREA, { skippedArea: 2 }, REMOTE_CONTEXT);

		// Act
		const act = handler(payload);

		// Assert
		await expect(act).rejects.toThrow('skip failed');
		expect(senderLines(vacuum.log)).toEqual([`skipArea command from ${REMOTE_SENDER_LINE}`]);
		expect(vacuum.log.error).toHaveBeenCalledWith(expect.stringContaining('Error executing skipArea command:'));
	});

	it('should log exactly one sender line when the filter reset handler is invoked with filter monitoring enabled', async () => {
		// Arrange
		const vacuum = buildVacuum(true);
		vacuum.configureHandler(behaviorHandler);
		const handler = getHandler(vacuum, 'HepaFilterMonitoring.resetCondition');
		const payload = buildPayload('HepaFilterMonitoring.resetCondition', {}, REMOTE_CONTEXT);

		// Act
		await handler(payload);

		// Assert
		expect(senderLines(vacuum.log)).toEqual([`HepaFilterMonitoring.resetCondition command from ${REMOTE_SENDER_LINE}`]);
		expect(behaviorHandler.executeCommand).toHaveBeenCalledWith(CommandNames.RESET_FILTER);
	});

	it('should not register the filter reset handler when filter monitoring is disabled', () => {
		// Arrange
		const vacuum = buildVacuum(false);

		// Act
		vacuum.configureHandler(behaviorHandler);

		// Assert
		const names = vi.mocked(vacuum.addCommandHandler).mock.calls.map(([name]) => name);
		expect(names).not.toContain('HepaFilterMonitoring.resetCondition');
	});
});
