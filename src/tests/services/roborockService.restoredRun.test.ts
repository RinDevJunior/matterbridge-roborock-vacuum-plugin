import { AnsiLogger } from 'matterbridge/logger';
import type { LocalStorage } from 'node-persist';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { AreaManagementService } from '../../services/areaManagementService.js';
import { RoborockService } from '../../services/roborockService.js';
import type { ServiceContainer } from '../../services/serviceContainer.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

describe('RoborockService restored-run proxies', () => {
	let service: RoborockService;

	beforeEach(() => {
		vi.clearAllMocks();
		const areaService = asPartial<AreaManagementService>({
			markRestoredRunPending: vi.fn(),
			consumeRestoredRunPending: vi.fn().mockReturnValue(true),
		});
		const container = asPartial<ServiceContainer>({
			getAuthenticationCoordinator: vi.fn().mockReturnValue({ authenticate: vi.fn() }),
			getDeviceManagementService: vi.fn().mockReturnValue({ stopService: vi.fn(), setIotApi: vi.fn() }),
			getAreaManagementService: vi.fn().mockReturnValue(areaService),
			getMessageRoutingService: vi.fn().mockReturnValue({ clearAll: vi.fn(), setIotApi: vi.fn() }),
			getPollingService: vi.fn().mockReturnValue({ stopPolling: vi.fn(), shutdown: vi.fn() }),
			getConnectionService: vi.fn().mockReturnValue({
				initializeMessageClient: vi.fn(),
				initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
				setDeviceNotify: vi.fn(),
			}),
			setUserData: vi.fn(),
			getIotApi: vi.fn(),
			synchronizeMessageClients: vi.fn(),
			destroy: vi.fn(),
		});
		service = new RoborockService(
			{
				refreshInterval: 10,
				baseUrl: 'https://api.roborock.com',
				persist: asPartial<LocalStorage>({ init: vi.fn(), getItem: vi.fn(), setItem: vi.fn() }),
				configManager: asPartial<PlatformConfigManager>({ username: 'u', password: 'p' }),
				container,
				toastMessage: vi.fn(),
			},
			createMockLogger() as AnsiLogger,
			asPartial<PlatformConfigManager>({ username: 'u', password: 'p' }),
		);
	});

	it('should delegate markRestoredRunPending to the area service for the same duid', () => {
		service.markRestoredRunPending('duid-proxy');

		expect(service['areaService'].markRestoredRunPending).toHaveBeenCalledWith('duid-proxy');
	});

	it('should delegate consumeRestoredRunPending and return its result', () => {
		vi.mocked(service['areaService'].consumeRestoredRunPending).mockReturnValueOnce(false);

		const result = service.consumeRestoredRunPending('duid-proxy');

		expect(service['areaService'].consumeRestoredRunPending).toHaveBeenCalledWith('duid-proxy');
		expect(result).toBe(false);
	});
});
