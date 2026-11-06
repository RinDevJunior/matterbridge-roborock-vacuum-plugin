import type { LocalStorage } from 'node-persist';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { ServiceContainer, type ServiceContainerConfig } from '../../services/serviceContainer.js';
import type { WssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';
import {
	asPartial,
	createMockConfigManager,
	createMockLocalStorage,
	createMockLogger,
	mkUser,
} from '../helpers/testUtils.js';

vi.mock('../../roborockCommunication/api/authClient.js', () => ({
	RoborockAuthenticateApi: vi.fn(),
}));

vi.mock('../../roborockCommunication/api/iotClient.js', () => ({
	RoborockIoTApi: vi.fn(),
}));

const BASE_URL = 'https://api.example.test';

describe('ServiceContainer (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let config: ServiceContainerConfig;
	let container: ServiceContainer;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		const persist: LocalStorage = createMockLocalStorage();
		const configManager: PlatformConfigManager = createMockConfigManager();
		config = {
			baseUrl: BASE_URL,
			refreshInterval: 30,
			persist,
			configManager,
			toastMessage: vi.fn() as WssSendSnackbarMessage,
		};
		container = new ServiceContainer(mockLogger, config);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should construct the login API with the default factory when no authenticateApiFactory is provided', () => {
		// Arrange / Act (container created in beforeEach)
		// Assert
		expect(RoborockAuthenticateApi).toHaveBeenCalledWith(mockLogger, undefined, undefined, BASE_URL);
	});

	it('should construct the IoT API with the default factory when setUserData is called without iotApiFactory', () => {
		// Arrange
		const userdata = mkUser();
		// Act
		container.setUserData(userdata);
		// Assert
		expect(RoborockIoTApi).toHaveBeenCalledWith(userdata, mockLogger);
		expect(container.getIotApi()).toBeDefined();
		expect(container.getUserData()).toBe(userdata);
	});

	it('should use the injected authenticateApiFactory instead of the default when provided', () => {
		// Arrange
		const injectedApi = asPartial<RoborockAuthenticateApi>({});
		const authenticateApiFactory = vi.fn().mockReturnValue(injectedApi);
		const customContainer = new ServiceContainer(mockLogger, { ...config, authenticateApiFactory });
		// Act / Assert
		expect(authenticateApiFactory).toHaveBeenCalledWith(mockLogger, BASE_URL);
		expect(customContainer.getLogger()).toBe(mockLogger);
	});
});
