import { describe, expect, it } from 'vitest';

import { createDefaultAdvancedFeature } from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { createMockLogger } from '../helpers/testUtils.js';

function makeConfig(overrides: Record<string, unknown> = {}): Parameters<typeof PlatformConfigManager.create>[0] {
	return {
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
	} as Parameters<typeof PlatformConfigManager.create>[0];
}

describe('PlatformConfigManager — Monoscope', () => {
	it('should return false for isMonoscopeEnabled when advanced feature is disabled', () => {
		const config = makeConfig();
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isMonoscopeEnabled).toBe(false);
	});

	it('should return false for isMonoscopeEnabled when advanced feature enabled but enableMonoscope is false', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableMonoscope: false,
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isMonoscopeEnabled).toBe(false);
	});

	it('should return true for isMonoscopeEnabled when both advanced feature and enableMonoscope are true', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableMonoscope: true,
					monoscopeSettings: { otlpEndpoint: 'http://localhost:4318' },
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.isMonoscopeEnabled).toBe(true);
	});

	it('should return undefined for monoscopeSettings when monoscope is disabled', () => {
		const config = makeConfig();
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.monoscopeSettings).toBeUndefined();
	});

	it('should return monoscopeSettings when monoscope is enabled', () => {
		const settings = { otlpEndpoint: 'http://localhost:4318', serviceName: 'my-plugin' };
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableMonoscope: true,
					monoscopeSettings: settings,
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.monoscopeSettings).toEqual(settings);
	});

	it('should return undefined for monoscopeSettings when advanced feature is disabled even if enableMonoscope is set', () => {
		const config = makeConfig({
			advancedFeature: {
				enableAdvancedFeature: false,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableMonoscope: true,
					monoscopeSettings: { otlpEndpoint: 'http://localhost:4318' },
				},
			},
		});
		const manager = PlatformConfigManager.create(config, createMockLogger());
		expect(manager.monoscopeSettings).toBeUndefined();
	});
});
