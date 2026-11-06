import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import type { LocalStorage } from 'node-persist';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENE_AREA_ID_MIN } from '../../constants/index.js';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { AreaManagementService } from '../../services/areaManagementService.js';
import type { AuthenticationCoordinator } from '../../services/authentication/AuthenticationCoordinator.js';
import type { MessageRoutingService } from '../../services/messageRoutingService.js';
import { RoborockService } from '../../services/roborockService.js';
import type { ServiceContainer } from '../../services/serviceContainer.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

function createMockAreaService() {
	return asPartial<AreaManagementService>({
		resolveInitialAreas: vi.fn(),
		ensureAreasForMap: vi.fn(),
		getV1ResolvedSegment: vi.fn(),
		requestV1MapRefresh: vi.fn(),
		getSelectedAreas: vi.fn().mockReturnValue([]),
		getSupportedAreas: vi.fn().mockReturnValue([]),
		getSupportedRoutines: vi.fn().mockReturnValue(undefined),
		getSupportedAreasIndexMap: vi.fn().mockReturnValue(undefined),
	});
}

function createMockMessageRoutingService() {
	return asPartial<MessageRoutingService>({
		startClean: vi.fn().mockResolvedValue(undefined),
		skipRoomCleaning: vi.fn().mockResolvedValue(undefined),
	});
}

function createMockAuthCoordinator() {
	return asPartial<AuthenticationCoordinator>({
		authenticate: vi.fn().mockResolvedValue(undefined),
	});
}

function createMockConfigManager(overrides: Partial<PlatformConfigManager> = {}): PlatformConfigManager {
	return asPartial<PlatformConfigManager>({
		username: 'testuser',
		password: 'testpass',
		verificationCode: undefined,
		authenticationMethod: 'Password',
		...overrides,
	});
}

function createMockContainer(
	areaService: AreaManagementService,
	messageService: MessageRoutingService,
	authCoordinator: AuthenticationCoordinator,
): ServiceContainer {
	return asPartial<ServiceContainer>({
		getAuthenticationCoordinator: vi.fn().mockReturnValue(authCoordinator),
		getDeviceManagementService: vi.fn().mockReturnValue({}),
		getAreaManagementService: vi.fn().mockReturnValue(areaService),
		getMessageRoutingService: vi.fn().mockReturnValue(messageService),
		getPollingService: vi.fn().mockReturnValue({}),
		getConnectionService: vi.fn().mockReturnValue({}),
		synchronizeMessageClients: vi.fn(),
		setUserData: vi.fn(),
		destroy: vi.fn(),
	});
}

/** Routine-as-room entry; a null locationName models a routine with no location info. */
function makeRoutine(areaId: number, locationName: string | null): ServiceArea.Area {
	return asPartial<ServiceArea.Area>({
		areaId,
		areaInfo: asPartial<ServiceArea.AreaInfo>({
			locationInfo:
				locationName === null ? null : asPartial<NonNullable<ServiceArea.AreaInfo['locationInfo']>>({ locationName }),
		}),
	});
}

describe('RoborockService gap coverage', () => {
	let logger: AnsiLogger;
	let areaService: AreaManagementService;
	let messageService: MessageRoutingService;
	let authCoordinator: AuthenticationCoordinator;
	let container: ServiceContainer;
	let service: RoborockService;

	function createService(configManager: PlatformConfigManager): RoborockService {
		return new RoborockService(
			{
				refreshInterval: 10,
				baseUrl: 'https://api.roborock.com',
				persist: asPartial<LocalStorage>({}),
				configManager,
				container,
				toastMessage: vi.fn(),
			},
			logger,
			configManager,
		);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		areaService = createMockAreaService();
		messageService = createMockMessageRoutingService();
		authCoordinator = createMockAuthCoordinator();
		container = createMockContainer(areaService, messageService, authCoordinator);
		service = createService(createMockConfigManager());
	});

	describe('authenticate debug logging', () => {
		it('should mask a provided password and verification code', async () => {
			const withSecrets = createService(createMockConfigManager({ password: 'secret', verificationCode: '123456' }));

			await withSecrets.authenticate();

			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Password: ******'));
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Verification Code: ******'));
		});

		it('should show not-provided when the password is missing', async () => {
			const noPassword = createService(createMockConfigManager({ password: undefined, verificationCode: '123456' }));

			await noPassword.authenticate();

			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Password: <not provided>'));
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Verification Code: ******'));
		});
	});

	describe('area and message delegation', () => {
		it('should delegate resolveInitialAreas to the area service and return its result', async () => {
			const expected = { supportedAreas: [], supportedMaps: [] };
			vi.mocked(areaService.resolveInitialAreas).mockResolvedValue(expected);

			const result = await service.resolveInitialAreas('duid-1');

			expect(result).toBe(expected);
			expect(areaService.resolveInitialAreas).toHaveBeenCalledWith('duid-1');
		});

		it('should delegate ensureAreasForMap with the map id and options and return its result', async () => {
			vi.mocked(areaService.ensureAreasForMap).mockResolvedValue(true);

			const result = await service.ensureAreasForMap('duid-1', 3, { switchFirst: true });

			expect(result).toBe(true);
			expect(areaService.ensureAreasForMap).toHaveBeenCalledWith('duid-1', 3, { switchFirst: true });
		});

		it('should delegate getV1ResolvedSegment to the area service and return the cached segment', () => {
			vi.mocked(areaService.getV1ResolvedSegment).mockReturnValue(7);

			const result = service.getV1ResolvedSegment('duid-1');

			expect(result).toBe(7);
			expect(areaService.getV1ResolvedSegment).toHaveBeenCalledWith('duid-1');
		});

		it('should delegate requestV1MapRefresh to the area service', async () => {
			vi.mocked(areaService.requestV1MapRefresh).mockResolvedValue(undefined);

			await service.requestV1MapRefresh('duid-1');

			expect(areaService.requestV1MapRefresh).toHaveBeenCalledWith('duid-1');
		});

		it('should delegate skipRoomCleaning to the message routing service', async () => {
			await service.skipRoomCleaning('duid-1');

			expect(messageService.skipRoomCleaning).toHaveBeenCalledWith('duid-1');
		});
	});

	describe('startClean routine ordering', () => {
		it('should choose the alphabetically first routine and treat a missing location name as empty', async () => {
			vi.mocked(areaService.getSelectedAreas).mockReturnValue([5001, 5002, 5003]);
			vi.mocked(areaService.getSupportedRoutines).mockReturnValue([
				makeRoutine(5001, 'Zeta'),
				makeRoutine(5002, null),
				makeRoutine(5003, 'Alpha'),
			]);

			await service.startClean('duid-1');

			expect(messageService.startClean).toHaveBeenCalledWith('duid-1', { type: 'routine', routineId: 2 });
		});

		it('should choose the alphabetically first of two named routines', async () => {
			vi.mocked(areaService.getSelectedAreas).mockReturnValue([5001, 5003]);
			vi.mocked(areaService.getSupportedRoutines).mockReturnValue([
				makeRoutine(5001, 'Zeta'),
				makeRoutine(5003, 'Alpha'),
			]);

			await service.startClean('duid-1');

			expect(messageService.startClean).toHaveBeenCalledWith('duid-1', {
				type: 'routine',
				routineId: 5003 - SCENE_AREA_ID_MIN,
			});
		});
	});
});
