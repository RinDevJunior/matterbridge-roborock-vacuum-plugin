import type { AxiosInstance, AxiosStatic } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import { asType, createMockLogger } from '../../helpers/testUtils.js';

const EMAIL = 'user@example.com';
const LOGIN_CODE_URL = 'api/v4/auth/email/login/code';

/**
 * Axios stub: `post` answers by URL with the given payload as `response.data`.
 * Shape of each payload mirrors the Roborock API envelope (`{ data: ... }` or `{ code, msg }`).
 */
function createAxiosStub(postResponses: Record<string, unknown>) {
	const post = vi.fn(async (url: string, _data?: unknown, _config?: unknown) => ({ data: postResponses[url] }));
	const instance = asType<AxiosInstance>({
		post,
		get: vi.fn(),
		interceptors: {
			request: { use: vi.fn() },
			response: { use: vi.fn() },
		},
	});
	return { instance, post };
}

function createFactory(instance: AxiosInstance): AxiosStatic {
	return asType<AxiosStatic>({ create: vi.fn(() => instance) });
}

function baseUrlResponse(url: string, country?: string, countrycode?: string) {
	return { data: { url, country, countrycode } };
}

function getLoginCodeParams(post: ReturnType<typeof createAxiosStub>['post']): Record<string, unknown> | undefined {
	const loginCall = post.mock.calls.find(([url]) => url === LOGIN_CODE_URL);
	const config = loginCall?.[2];
	return asType<{ params?: Record<string, unknown> } | undefined>(config)?.params;
}

describe('RoborockAuthenticateApi (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
	});

	describe('loginWithCodeV4 country fallback', () => {
		it('should send Russia and RU when base URL is a ruiot host and no country is cached', async () => {
			// Arrange
			const { instance, post } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://ruiot.example'),
				'api/v3/key/sign': { data: { k: 'signed' } },
				[LOGIN_CODE_URL]: { data: { token: 'tok' } },
			});
			const api = new RoborockAuthenticateApi(
				mockLogger,
				createFactory(instance),
				'session-1',
				'https://ruiot.example',
			);

			// Act
			await api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(getLoginCodeParams(post)).toEqual(expect.objectContaining({ country: 'Russia', countryCode: 'RU' }));
		});

		it('should send empty country and country code when base URL matches no known host', async () => {
			// Arrange
			const { instance, post } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://example.com'),
				'api/v3/key/sign': { data: { k: 'signed' } },
				[LOGIN_CODE_URL]: { data: { token: 'tok' } },
			});
			const api = new RoborockAuthenticateApi(mockLogger, createFactory(instance), 'session-1', 'https://example.com');

			// Act
			await api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(getLoginCodeParams(post)).toEqual(expect.objectContaining({ country: '', countryCode: '' }));
		});

		it('should keep the cached country and fill only the missing country code', async () => {
			// Arrange: country cached from base URL lookup, country code absent
			const { instance, post } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://euiot.example', 'Austria', undefined),
				'api/v3/key/sign': { data: { k: 'signed' } },
				[LOGIN_CODE_URL]: { data: { token: 'tok' } },
			});
			const api = new RoborockAuthenticateApi(
				mockLogger,
				createFactory(instance),
				'session-1',
				'https://euiot.example',
			);

			// Act
			await api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(getLoginCodeParams(post)).toEqual(expect.objectContaining({ country: 'Austria', countryCode: 'DE' }));
		});
	});

	describe('error envelopes without msg', () => {
		it('should reject with an empty message when base URL lookup returns no data', async () => {
			// Arrange
			const { instance } = createAxiosStub({ 'api/v1/getUrlByEmail': { code: 500 } });
			const api = new RoborockAuthenticateApi(mockLogger, createFactory(instance), 'session-1');

			// Act & Assert
			await expect(api.loginWithPassword(EMAIL, 'pw')).rejects.toThrow('Failed to retrieve base URL: ');
		});

		it('should reject with the code when password login returns no user data', async () => {
			// Arrange
			const { instance } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://usiot.example'),
				'api/v1/login': { code: 500 },
			});
			const api = new RoborockAuthenticateApi(mockLogger, createFactory(instance), 'session-1');

			// Act & Assert
			await expect(api.loginWithPassword(EMAIL, 'pw')).rejects.toThrow('Authentication failed:  code: 500');
		});

		it('should reject with the code when code login returns no user data', async () => {
			// Arrange
			const { instance } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://usiot.example'),
				'api/v3/key/sign': { data: { k: 'signed' } },
				[LOGIN_CODE_URL]: { code: 500 },
			});
			const api = new RoborockAuthenticateApi(mockLogger, createFactory(instance), 'session-1');

			// Act & Assert
			await expect(api.loginWithCodeV4(EMAIL, '123456')).rejects.toThrow('Authentication failed:  code: 500');
		});

		it('should reject with an empty message when key signing returns no key', async () => {
			// Arrange
			const { instance } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://usiot.example'),
				'api/v3/key/sign': { code: 500 },
			});
			const api = new RoborockAuthenticateApi(mockLogger, createFactory(instance), 'session-1');

			// Act & Assert
			await expect(api.loginWithCodeV4(EMAIL, '123456')).rejects.toThrow('Failed to sign key: ');
		});
	});

	describe('apiForUser default base URL', () => {
		it('should create the API instance with the constructor base URL when none is passed', async () => {
			// Arrange
			const { instance } = createAxiosStub({
				'api/v1/getUrlByEmail': baseUrlResponse('https://other.example'),
				'api/v1/login': { data: { token: 'tok' } },
			});
			const factory = createFactory(instance);
			const api = new RoborockAuthenticateApi(mockLogger, factory, 'session-1', 'https://custom.example');

			// Act
			await api.loginWithPassword(EMAIL, 'pw');

			// Assert
			expect(factory.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://custom.example' }));
		});
	});
});
