import crypto from 'node:crypto';

import axios, { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { asType, createMockLogger } from '../../helpers/testUtils.js';

vi.mock('axios-retry', () => {
	const axiosRetryMock = Object.assign(vi.fn(), {
		exponentialDelay: vi.fn(),
		isNetworkOrIdempotentRequestError: vi.fn(() => false),
	});
	return { default: axiosRetryMock };
});

type RequestInterceptor = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;

function createAxiosStub(url = 'https://api.example/user/homes/1') {
	const requestInterceptors: RequestInterceptor[] = [];
	const get = vi.fn();
	const post = vi.fn();
	const getUri = vi.fn(() => url);
	const instance = asType<AxiosInstance>({
		get,
		post,
		getUri,
		interceptors: {
			request: {
				use: vi.fn((fn: RequestInterceptor) => {
					requestInterceptors.push(fn);
					return requestInterceptors.length - 1;
				}),
			},
			response: { use: vi.fn() },
		},
	});
	return { instance, get, post, getUri, requestInterceptors };
}

function createUserData(): UserData {
	return asType<UserData>({
		rriot: { r: { a: 'https://api.example' }, u: 'uid', s: 'sec', h: 'hmac-key', k: 'k' },
	});
}

function getRetryConfig(): IAxiosRetryConfig {
	const config = vi.mocked(axiosRetry).mock.calls[0]?.[1];
	if (!config) {
		throw new Error('axiosRetry was not configured');
	}
	return config;
}

describe('RoborockIoTApi (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let stub: ReturnType<typeof createAxiosStub>;
	let factory: AxiosStatic;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		stub = createAxiosStub();
		factory = asType<AxiosStatic>({ create: vi.fn(() => stub.instance) });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should create the axios instance from the default axios factory when none is provided', () => {
			// Arrange
			const createSpy = vi.spyOn(axios, 'create').mockReturnValue(stub.instance);

			// Act
			new RoborockIoTApi(createUserData(), mockLogger);

			// Assert
			expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://api.example' }));
		});

		it('should log an error with the thrown Error when axios-retry configuration throws', () => {
			// Arrange
			vi.mocked(axiosRetry).mockImplementationOnce(() => {
				throw new Error('retry-boom');
			});

			// Act
			new RoborockIoTApi(createUserData(), mockLogger, factory);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to configure axios-retry'));
			expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('unknown'));
		});

		it('should log unknown when axios-retry configuration throws a falsy value', () => {
			// Arrange
			vi.mocked(axiosRetry).mockImplementationOnce(() => {
				throw asType<Error>(undefined);
			});

			// Act
			new RoborockIoTApi(createUserData(), mockLogger, factory);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith('Failed to configure axios-retry: unknown');
		});
	});

	describe('retry condition', () => {
		beforeEach(() => {
			new RoborockIoTApi(createUserData(), mockLogger, factory);
		});

		it.each([
			{ name: 'ETIMEDOUT code', error: { code: 'ETIMEDOUT' }, expected: true },
			{ name: 'ECONNABORTED code', error: { code: 'ECONNABORTED' }, expected: true },
			{ name: 'ECONNRESET code', error: { code: 'ECONNRESET' }, expected: true },
			{ name: 'timeout message', error: { message: 'request timeout' }, expected: true },
			{ name: 'plain non-network error', error: {}, expected: false },
			{ name: 'undefined error', error: undefined, expected: false },
		])('should return $expected for $name', ({ error, expected }) => {
			// Arrange
			const retryCondition = asType<(err: unknown) => boolean>(getRetryConfig().retryCondition);

			// Act
			const result = retryCondition(error);

			// Assert
			expect(result).toBe(expected);
		});
	});

	describe('onRetry callback', () => {
		beforeEach(() => {
			new RoborockIoTApi(createUserData(), mockLogger, factory);
		});

		it('should log unknown when retry happens without an error', () => {
			// Arrange
			const onRetry = asType<(count: number, err: unknown, cfg: unknown) => void>(getRetryConfig().onRetry);

			// Act
			onRetry(1, undefined, {});

			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith('Retrying request, attempt #1 due to error: unknown');
		});

		it('should log the debug representation of the error instead of unknown when retry happens with an error', () => {
			// Arrange
			const onRetry = asType<(count: number, err: unknown, cfg: unknown) => void>(getRetryConfig().onRetry);

			// Act
			onRetry(2, new Error('socket hang up'), {});

			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('attempt #2'));
			expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('unknown'));
		});
	});

	describe('request interceptor', () => {
		it('should set a Hawk Authorization header when the request URL is valid', () => {
			// Arrange
			new RoborockIoTApi(createUserData(), mockLogger, factory);
			const interceptor = stub.requestInterceptors[0];
			const config = asType<InternalAxiosRequestConfig>({ headers: {} });

			// Act
			const result = interceptor(config);

			// Assert
			expect(result.headers.Authorization).toEqual(expect.stringContaining('Hawk id="uid"'));
		});

		it('should log an error when the request URL cannot be parsed', () => {
			// Arrange
			stub.getUri.mockReturnValue('not a url');
			new RoborockIoTApi(createUserData(), mockLogger, factory);
			const interceptor = stub.requestInterceptors[0];

			// Act
			interceptor(asType<InternalAxiosRequestConfig>({ headers: {} }));

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize RESTAPI'));
		});

		it('should log undefined when the URL lookup throws a falsy value', () => {
			// Arrange
			stub.getUri.mockImplementation(() => {
				throw asType<Error>(undefined);
			});
			new RoborockIoTApi(createUserData(), mockLogger, factory);
			const interceptor = stub.requestInterceptors[0];

			// Act
			interceptor(asType<InternalAxiosRequestConfig>({ headers: {} }));

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize RESTAPI undefined');
		});
	});

	describe('API methods with falsy rejection', () => {
		it.each([
			{ name: 'getHome', call: (api: RoborockIoTApi) => api.getHome(1) },
			{ name: 'getHomev2', call: (api: RoborockIoTApi) => api.getHomev2(1) },
			{ name: 'getHomev3', call: (api: RoborockIoTApi) => api.getHomev3(1) },
			{ name: 'getScenes', call: (api: RoborockIoTApi) => api.getScenes(1) },
			{ name: 'startScene', call: (api: RoborockIoTApi) => api.startScene(1) },
			{ name: 'getCustom', call: (api: RoborockIoTApi) => api.getCustom('user/custom') },
		])('should log Failed: unknown and return undefined when $name rejects with a falsy value', async ({ call }) => {
			// Arrange
			stub.get.mockRejectedValue(undefined);
			stub.post.mockRejectedValue(undefined);
			const api = new RoborockIoTApi(createUserData(), mockLogger, factory);

			// Act
			const result = await call(api);

			// Assert
			expect(result).toBeUndefined();
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed: unknown'));
		});
	});

	describe('processExtraHawkValues', () => {
		it('should return the md5 of sorted key=value pairs when values are provided', () => {
			// Arrange
			const api = new RoborockIoTApi(createUserData(), mockLogger, factory);
			const expected = crypto.createHash('md5').update('a=1&b=2').digest('hex');

			// Act
			const result = api['processExtraHawkValues']({ b: 2, a: 1 });

			// Assert
			expect(result).toBe(expected);
		});

		it('should return an empty string when no values are provided', () => {
			// Arrange
			const api = new RoborockIoTApi(createUserData(), mockLogger, factory);

			// Act
			const result = api['processExtraHawkValues'](undefined);

			// Assert
			expect(result).toBe('');
		});
	});
});
