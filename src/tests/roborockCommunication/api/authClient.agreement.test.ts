import type { AxiosInstance, AxiosStatic } from 'axios';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import { asPartial, asType, createMockLogger } from '../../helpers/testUtils.js';

const EMAIL = 'user@example.com';
const SIGN_PATH = 'api/v3/key/sign';
const LOGIN_PATH = 'api/v4/auth/email/login/code';
const AGREEMENT_PATH = 'api/v3/app/agreement/latest';
const DEFAULT_BASE_URL = 'https://usiot.roborock.com';
const UNKNOWN_BASE_URL = 'https://unknown.example.com';

interface TestHarness {
	api: RoborockAuthenticateApi;
	logger: ReturnType<typeof createMockLogger>;
	post: Mock;
	get: Mock;
}

function createHarness(constructorBaseUrl = DEFAULT_BASE_URL): TestHarness {
	const logger = createMockLogger();
	const post = vi.fn();
	const get = vi.fn();
	const instance = asType<AxiosInstance>({
		post,
		get,
		interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
	});
	const api = new RoborockAuthenticateApi(
		logger,
		asPartial<AxiosStatic>({ create: () => instance }),
		'session-under-test',
		constructorBaseUrl,
	);
	return { api, logger, post, get };
}

/** Primes the private session cache so getBaseUrl never performs a network lookup. */
function primeSession(api: RoborockAuthenticateApi, baseUrl: string, country?: string): void {
	api['username'] = EMAIL;
	api['cachedBaseUrl'] = baseUrl;
	if (country !== undefined) {
		api['cachedCountry'] = country;
		api['cachedCountryCode'] = 'XX';
	}
}

/** Sign-key requests succeed; the login request returns the given body. */
function routePost(post: Mock, loginBody: unknown): void {
	post.mockImplementation((url: string) =>
		Promise.resolve(url === SIGN_PATH ? { data: { data: { k: 'signed-key' } } } : { data: loginBody }),
	);
}

const LOGIN_SUCCESS = { code: 200, msg: '', data: { token: 'tok', uid: 'u1' } };

function findLoginCall(post: Mock): unknown[] | undefined {
	return post.mock.calls.find((args: unknown[]) => args[0] === LOGIN_PATH);
}

describe('RoborockAuthenticateApi agreement version lookup', () => {
	let h: TestHarness;

	beforeEach(() => {
		vi.clearAllMocks();
		h = createHarness();
	});

	describe('loginWithCodeV4 with a successful lookup', () => {
		it('should send fetched agreement version in login request when lookup succeeds', async () => {
			// Arrange
			primeSession(h.api, DEFAULT_BASE_URL, 'Germany');
			h.get.mockResolvedValue({ data: { code: 200, data: { majorVersion: 15, minorVersion: 2 } } });
			routePost(h.post, LOGIN_SUCCESS);

			// Act
			const result = await h.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(result.token).toBe('tok');
			expect(findLoginCall(h.post)?.[2]).toMatchObject({
				params: { majorVersion: '15', minorVersion: '2' },
			});
		});

		it('should request latest agreement with cached country and timeout when logging in', async () => {
			// Arrange
			primeSession(h.api, DEFAULT_BASE_URL, 'Germany');
			h.get.mockResolvedValue({ data: { code: 200, data: { majorVersion: 15, minorVersion: 2 } } });
			routePost(h.post, LOGIN_SUCCESS);

			// Act
			await h.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(h.get).toHaveBeenCalledTimes(1);
			expect(h.get).toHaveBeenCalledWith(AGREEMENT_PATH, {
				params: { country: 'Germany' },
				timeout: 5000,
			});
		});
	});

	describe('loginWithCodeV4 fallback to default agreement version', () => {
		it('should fall back to 14/0 and still log in when lookup rejects', async () => {
			// Arrange
			primeSession(h.api, DEFAULT_BASE_URL, 'Germany');
			h.get.mockRejectedValue(new Error('timeout'));
			routePost(h.post, LOGIN_SUCCESS);

			// Act
			const result = await h.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(result.token).toBe('tok');
			expect(findLoginCall(h.post)?.[2]).toMatchObject({
				params: { majorVersion: '14', minorVersion: '0' },
			});
			expect(vi.mocked(h.logger.debug)).toHaveBeenCalled();
		});

		it.each([
			['non-200 code', { data: { code: 3002, msg: 'error', data: { majorVersion: 15, minorVersion: 2 } } }],
			['missing data', { data: { code: 200, msg: '' } }],
			['undefined response', undefined],
			['string majorVersion', { data: { code: 200, data: { majorVersion: '15', minorVersion: 2 } } }],
			['null minorVersion', { data: { code: 200, data: { majorVersion: 15, minorVersion: null } } }],
			['fractional majorVersion', { data: { code: 200, data: { majorVersion: 1.5, minorVersion: 2 } } }],
			['negative minorVersion', { data: { code: 200, data: { majorVersion: 15, minorVersion: -1 } } }],
		])('should fall back to 14/0 and still log in when lookup returns %s', async (_label, lookupResponse) => {
			// Arrange
			primeSession(h.api, DEFAULT_BASE_URL, 'Germany');
			h.get.mockResolvedValue(lookupResponse);
			routePost(h.post, LOGIN_SUCCESS);

			// Act
			const result = await h.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(result.token).toBe('tok');
			expect(findLoginCall(h.post)?.[2]).toMatchObject({
				params: { majorVersion: '14', minorVersion: '0' },
			});
		});

		it('should fall back to 14/0 without throwing when lookup resolves undefined', async () => {
			// Arrange
			primeSession(h.api, DEFAULT_BASE_URL, 'Germany');
			h.get.mockReturnValue(undefined);
			routePost(h.post, LOGIN_SUCCESS);

			// Act
			const act = h.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			await expect(act).resolves.toMatchObject({ token: 'tok' });
			expect(findLoginCall(h.post)?.[2]).toMatchObject({
				params: { majorVersion: '14', minorVersion: '0' },
			});
		});

		it('should not request agreement and fall back to 14/0 when country is empty', async () => {
			// Arrange
			const unknownHarness = createHarness(UNKNOWN_BASE_URL);
			primeSession(unknownHarness.api, UNKNOWN_BASE_URL);
			routePost(unknownHarness.post, LOGIN_SUCCESS);

			// Act
			const result = await unknownHarness.api.loginWithCodeV4(EMAIL, '123456');

			// Assert
			expect(result.token).toBe('tok');
			expect(unknownHarness.get).not.toHaveBeenCalled();
			expect(findLoginCall(unknownHarness.post)?.[2]).toMatchObject({
				params: { country: '', majorVersion: '14', minorVersion: '0' },
			});
		});
	});

	describe('authV4 generic error', () => {
		it('should throw generic authentication error when code is 500 and no token', () => {
			expect(() => h.api['authV4']('e', { code: 500, msg: 'boom', data: undefined })).toThrow(
				'Authentication failed: boom code: 500',
			);
		});
	});
});
