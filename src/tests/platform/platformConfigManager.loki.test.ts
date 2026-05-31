import { describe, expect, it } from 'vitest';

import { createDefaultAdvancedFeature } from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { asType, createMockLogger } from '../helpers/testUtils.js';

function makeConfig(overrides: Record<string, unknown> = {}): Parameters<typeof PlatformConfigManager.create>[0] {
	return asType({
		name: 'test',
		type: 'DynamicPlatform',
		authentication: {
			username: 'user@example.com',
			region: 'US',
			forceAuthentication: false,
			authenticationMethod: 'Password',
			password: 'pass',
		},
		pluginConfiguration: {
			whiteList: [],
			enableServerMode: false,
			enableMultipleMap: false,
			sanitizeSensitiveLogs: true,
			refreshInterval: 60,
			debug: false,
			unregisterOnShutdown: false,
		},
		advancedFeature: createDefaultAdvancedFeature(),
		...overrides,
	});
}

describe('PlatformConfigManager — Grafana Loki', () => {
	it('should return false for isLokiEnabled when advanced feature is disabled', () => {
		const config = makeConfig();
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isLokiEnabled).toBe(false);
	});

	it('should return false for isLokiEnabled when advanced feature enabled but enableLoki is false', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableLoki: false,
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isLokiEnabled).toBe(false);
	});

	it('should return true for isLokiEnabled when both advanced feature and enableLoki are true', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableLoki: true,
					lokiSettings: { lokiEndpoint: 'http://localhost:3100' },
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isLokiEnabled).toBe(true);
	});

	it('should return undefined for lokiSettings when loki is disabled', () => {
		const config = makeConfig();
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.lokiSettings).toBeUndefined();
	});

	it('should return lokiSettings when loki is enabled', () => {
		const settings = { lokiEndpoint: 'http://localhost:3100', serviceName: 'my-plugin' };
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableLoki: true,
					lokiSettings: settings,
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.lokiSettings).toEqual(settings);
	});

	it('should return undefined for lokiSettings when advanced feature is disabled even if enableLoki is set', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: false,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableLoki: true,
					lokiSettings: { lokiEndpoint: 'http://localhost:3100' },
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.lokiSettings).toBeUndefined();
	});
});
