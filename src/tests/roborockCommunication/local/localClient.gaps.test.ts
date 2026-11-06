import type { Socket } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalNetworkClient } from '../../../roborockCommunication/local/localClient.js';
import type { MessageContext } from '../../../roborockCommunication/models/index.js';
import type { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { asType, createMockLogger, wait } from '../../helpers/testUtils.js';

/**
 * Replaces node:net Socket with a minimal event-emitter stub so no real socket or port is opened.
 * Events are dispatched synchronously through `emit`, mirroring what the client registers via `on`.
 */
vi.mock('node:net', () => {
	class FakeSocket {
		public readyState = 'open';
		public destroyed = false;
		public writable = true;
		public readable = true;
		private readonly handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();

		public on(event: string, handler: (...args: unknown[]) => unknown): this {
			const list = this.handlers.get(event) ?? [];
			list.push(handler);
			this.handlers.set(event, list);
			return this;
		}

		public emit(event: string, ...args: unknown[]): boolean {
			for (const handler of this.handlers.get(event) ?? []) {
				handler(...args);
			}
			return true;
		}

		public setTimeout(): this {
			return this;
		}

		public connect(): this {
			return this;
		}

		public write(): boolean {
			return true;
		}

		public destroy(): this {
			this.destroyed = true;
			return this;
		}
	}
	return { Socket: FakeSocket };
});

const DUID = 'duid-1';
const IP = '192.168.1.10';

function createMockResponseBroadcaster(): ResponseBroadcaster {
	return asType<ResponseBroadcaster>({
		register: vi.fn(),
		deregister: vi.fn(),
		onMessage: vi.fn(),
	});
}

/** Reads the client's current socket without TypeScript narrowing it from earlier assignments in the test. */
function getCurrentSocket(client: LocalNetworkClient): Socket | undefined {
	return client['socket'];
}

describe('LocalNetworkClient (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let client: LocalNetworkClient;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		client = new LocalNetworkClient(mockLogger, asType<MessageContext>({}), DUID, IP, createMockResponseBroadcaster());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('events from a replaced socket', () => {
		it('should ignore the end event from a stale socket and handle it for the current socket', () => {
			// Arrange
			client.connect();
			const staleSocket: Socket | undefined = client['socket'];
			client['socket'] = undefined;
			client.connect();

			// Act
			staleSocket?.emit('end');

			// Assert
			expect(mockLogger.notice).not.toHaveBeenCalledWith(expect.stringContaining('socket ended'));

			// Act
			getCurrentSocket(client)?.emit('end');

			// Assert
			expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('socket ended'));
		});

		it('should ignore the error event from a stale socket and report the error from the current socket', async () => {
			// Arrange
			client.connect();
			const staleSocket: Socket | undefined = client['socket'];
			client['socket'] = undefined;
			client.connect();

			// Act
			staleSocket?.emit('error', new Error('stale-error'));
			await wait(0);

			// Assert
			expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('stale-error'));

			// Act
			getCurrentSocket(client)?.emit('error', new Error('current-error'));
			await wait(0);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('current-error'));
		});
	});

	describe('close event handling', () => {
		it('should not log a disconnect warning when the disconnect was intentional', async () => {
			// Arrange
			client.connect();
			client['intentionalDisconnect'] = true;

			// Act
			client['socket']?.emit('close', false);
			await wait(0);

			// Assert
			expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('socket disconnected'));
		});

		it.each([
			{ hadError: true, expected: 'Is having error' },
			{ hadError: false, expected: 'No error detected' },
		])('should log "$expected" when the socket closes with hadError=$hadError', async ({ hadError, expected }) => {
			// Arrange
			client.connect();

			// Act
			client['socket']?.emit('close', hadError);
			await wait(0);

			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(expected));
		});
	});

	describe('error and disconnect handlers without a socket', () => {
		it('should log the socket error without throwing when no socket is set', async () => {
			// Arrange
			const error = new Error('no-socket');

			// Act & Assert
			await expect(client['onError'](error)).resolves.toBeUndefined();
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Socket error for duid-1: no-socket'));
		});

		it('should log the disconnect without throwing when no socket is set', async () => {
			// Arrange & Act & Assert
			await expect(client['onDisconnect'](false)).resolves.toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No error detected'));
		});
	});

	describe('incoming data', () => {
		it('should keep an incomplete message in the buffer and not deserialize it', async () => {
			// Arrange: length prefix says 10 bytes but only 3 follow
			client.connect();
			const deserializeSpy = vi.spyOn(client['deserializer'], 'deserialize');
			const partial = Buffer.from([0, 0, 0, 10, 1, 2, 3]);

			// Act
			client['socket']?.emit('data', partial);
			await wait(0);

			// Assert
			expect(deserializeSpy).not.toHaveBeenCalled();
			expect(client['buffer'].get()).toEqual(partial);
		});

		it('should log a non-Error thrown by the deserializer as text', async () => {
			// Arrange
			client.connect();
			vi.spyOn(client['deserializer'], 'deserialize').mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act
			client['socket']?.emit('data', Buffer.from([0, 0, 0, 2, 0xaa, 0xbb]));
			await wait(0);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('unable to process message with error: boom'),
			);
		});

		it('should log the message when the deserializer throws an Error without a stack', async () => {
			// Arrange
			client.connect();
			const error = new Error('no-stack-error');
			error.stack = undefined;
			vi.spyOn(client['deserializer'], 'deserialize').mockImplementation(() => {
				throw error;
			});

			// Act
			client['socket']?.emit('data', Buffer.from([0, 0, 0, 2, 0xaa, 0xbb]));
			await wait(0);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('no-stack-error'));
		});

		it('should log a read buffer error when appending incoming data throws a non-Error', async () => {
			// Arrange
			client.connect();
			vi.spyOn(client['buffer'], 'append').mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act
			client['socket']?.emit('data', Buffer.from([0, 0, 0, 2, 0xaa, 0xbb]));
			await wait(0);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('read socket buffer error: boom'));
		});
	});

	describe('socket event listener rejection', () => {
		it('should log an unhandled error when an async socket listener rejects with a non-Error', async () => {
			// Arrange
			client.connect();
			vi.mocked(mockLogger.notice).mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act
			client['socket']?.emit('end');
			await wait(0);

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unhandled error in'));
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
		});
	});
});
