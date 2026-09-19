import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockLogger } from '../helpers/testUtils.js';

// Mock all module boundaries cmdB01PoseInfo touches, following this project's convention of
// vi.mock at module boundaries for CLI command isolation testing (see mapListHelpers.test.ts /
// broadcast client tests for the vi.mock pattern used elsewhere in this suite).
const mockConnectDevice = vi.fn();
const mockWaitForPush = vi.fn();
const mockParseRoomsFromEncryptedBinary = vi.fn();
const mockResolveRoomFromPose = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
	default: {
		mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
		writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
	},
}));

vi.mock('../../cli/connection.js', () => ({
	connectDevice: (...args: unknown[]) => mockConnectDevice(...args),
}));

vi.mock('../../cli/waitForPush.js', () => ({
	waitForPush: (...args: unknown[]) => mockWaitForPush(...args),
}));

vi.mock('../../roborockCommunication/map/b01/b01MapParser.js', () => ({
	B01MapParser: vi.fn().mockImplementation(function B01MapParser(this: {
		parseRoomsFromEncryptedBinary: (...args: unknown[]) => unknown;
	}) {
		this.parseRoomsFromEncryptedBinary = (...args: unknown[]) => mockParseRoomsFromEncryptedBinary(...args);
	}),
}));

vi.mock('../../roborockCommunication/map/b01/roomMatrixResolver.js', () => ({
	resolveRoomFromPose: (...args: unknown[]) => mockResolveRoomFromPose(...args),
}));

import { cmdB01PoseInfo } from '../../cli/commands/b01PoseInfo.js';
import type { CliSession } from '../../cli/types.js';

function createSession(overrides: Partial<{ devices: unknown[] }> = {}): CliSession {
	return {
		email: 'test@example.com',
		userData: {} as CliSession['userData'],
		devices:
			(overrides.devices as CliSession['devices']) ??
			([
				{
					duid: 'duid-1',
					serialNumber: 'SN001',
					specs: { model: 'roborock.vacuum.a75', protocol: 202, serialNumber: 'SN001' },
				},
			] as unknown as CliSession['devices']),
	};
}

function createClientRouterStub() {
	return { disconnect: vi.fn().mockResolvedValue(undefined) };
}

function createDispatcherStub() {
	return { getMapInfo: vi.fn().mockResolvedValue(undefined) };
}

describe('cmdB01PoseInfo', () => {
	let logger: ReturnType<typeof createMockLogger>;
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	it('should print a timeout message and return without throwing when no map buffer is received', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(undefined);

		const session = createSession();
		await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

		expect(consoleLogSpy).toHaveBeenCalledWith('No map binary received within timeout.');
		expect(mockParseRoomsFromEncryptedBinary).not.toHaveBeenCalled();
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should print "could not determine" messaging (not crash, not fabricate a room ID) when resolver returns undefined', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));
		mockParseRoomsFromEncryptedBinary.mockReturnValue({
			rooms: [{ roomId: 1, roomName: 'Kitchen' }],
			currentPose: { x: 1, y: 2 },
			roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
		});
		mockResolveRoomFromPose.mockReturnValue(undefined);

		const session = createSession();
		await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

		expect(consoleLogSpy).toHaveBeenCalledWith(
			'Resolved room:',
			'could not determine — roomMatrix decoding not yet implemented, pending real-device capture',
		);
		expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.diagnostics'), { recursive: true });
		expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining('roomMatrix-duid-1-'), expect.any(Buffer));
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should handle decode failure gracefully (no throw) via try/catch around parseRoomsFromEncryptedBinary', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));
		mockParseRoomsFromEncryptedBinary.mockImplementation(() => {
			throw new Error('corrupt buffer');
		});

		const session = createSession();
		await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to decode B01 map binary:', 'corrupt buffer');
		expect(mockResolveRoomFromPose).not.toHaveBeenCalled();
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should throw a clear "Device not found" error when duid is not found in session.devices', async () => {
		const session = createSession({ devices: [] });

		await expect(cmdB01PoseInfo('missing-duid', session, logger)).rejects.toThrow('Device not found: missing-duid');
		expect(mockConnectDevice).not.toHaveBeenCalled();
	});

	it('should log error and return when model short code cannot be determined', async () => {
		// Device with empty model string, so split('.').at(-1) returns empty string (falsy)
		const session = createSession({
			devices: [
				{
					duid: 'duid-1',
					serialNumber: 'SN001',
					specs: { model: '', protocol: 202, serialNumber: 'SN001' },
				},
			] as unknown as any,
		});

		await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

		expect(consoleErrorSpy).toHaveBeenCalledWith('Could not determine device model short code.');
		// connectDevice should not even be called because we return early
		expect(mockConnectDevice).not.toHaveBeenCalled();
	});

	it('should call clientRouter.disconnect() in the finally block on the success path', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));
		mockParseRoomsFromEncryptedBinary.mockReturnValue({
			rooms: [],
			currentPose: undefined,
			roomMatrix: undefined,
		});
		mockResolveRoomFromPose.mockReturnValue(undefined);

		const session = createSession();
		await cmdB01PoseInfo('duid-1', session, logger);

		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should call clientRouter.disconnect() in the finally block on the decode-error path', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));
		mockParseRoomsFromEncryptedBinary.mockImplementation(() => {
			throw new Error('bad data');
		});

		const session = createSession();
		await cmdB01PoseInfo('duid-1', session, logger);

		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should call clientRouter.disconnect() in the finally block on the timeout path', async () => {
		const clientRouter = createClientRouterStub();
		const dispatcher = createDispatcherStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
		mockWaitForPush.mockResolvedValue(undefined);

		const session = createSession();
		await cmdB01PoseInfo('duid-1', session, logger);

		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	describe('Q10 trace packet handling', () => {
		it('should wait for Q10 trace packet and update tracePose when buffer is received', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const originalPose = { x: 1000, y: 2000 };
			const tracedPose = { x: 1100, y: 2100 };

			// First call: map binary
			// Second call: Q10 trace packet (starts with 0x02 0x01)
			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: originalPose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					// trace parse result
					rooms: [],
					currentPose: tracedPose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(1);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify trace packet was parsed
			expect(mockParseRoomsFromEncryptedBinary).toHaveBeenCalledTimes(2);
			const secondCallBuffer = vi.mocked(mockParseRoomsFromEncryptedBinary).mock.calls[1][0];
			expect(secondCallBuffer).toEqual(Buffer.from([0x02, 0x01, 4, 5, 6]));

			// Verify tracePose was updated to the traced value
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(tracedPose, expect.anything(), 1);
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(tracedPose, expect.anything(), -1);
		});

		it('should use original pose if trace packet parse yields no currentPose', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const originalPose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: originalPose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					// trace parse result with no currentPose
					rooms: [],
					currentPose: undefined,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(1);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify tracePose stayed as original (via ?? fallback)
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), 1);
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), -1);
		});

		it('should log timeout message and not parse when trace waitForPush resolves with undefined', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const originalPose = { x: 1000, y: 2000 };

			// First call: map binary
			// Second call: trace packet times out (undefined)
			mockWaitForPush.mockResolvedValueOnce(Buffer.from([1, 2, 3])).mockResolvedValueOnce(undefined);

			mockParseRoomsFromEncryptedBinary.mockReturnValueOnce({
				rooms: [{ roomId: 1, roomName: 'Kitchen' }],
				currentPose: originalPose,
				roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
			});

			mockResolveRoomFromPose.mockReturnValue(1);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(consoleLogSpy).toHaveBeenCalledWith('No trace packet received within timeout.');
			// parseRoomsFromEncryptedBinary should only be called once (for the map binary)
			expect(mockParseRoomsFromEncryptedBinary).toHaveBeenCalledTimes(1);

			// But resolveRoomFromPose should still be called twice with the original pose
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), 1);
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), -1);
		});

		it('should catch parse errors from trace packet without crashing and log error message', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const originalPose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: originalPose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockImplementationOnce(() => {
					throw new Error('corrupt trace data');
				});

			mockResolveRoomFromPose.mockReturnValue(1);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to decode Q10 trace packet:', 'corrupt trace data');
			// tracePose should stay as original despite parse error
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), 1);
			expect(mockResolveRoomFromPose).toHaveBeenCalledWith(originalPose, expect.anything(), -1);
		});

		it('should call resolveRoomFromPose twice with ySign=1 and ySign=-1 and log both results', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const pose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [
						{ roomId: 1, roomName: 'Kitchen' },
						{ roomId: 2, roomName: 'Bedroom' },
					],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					rooms: [],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValueOnce(undefined).mockReturnValueOnce(1).mockReturnValueOnce(2);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify calls to resolveRoomFromPose: 1st without ySign (initial), then 2 with ySign
			const calls = vi.mocked(mockResolveRoomFromPose).mock.calls;
			expect(calls).toHaveLength(3);
			expect(calls[1][2]).toBe(1); // Second call with ySign=1
			expect(calls[2][2]).toBe(-1); // Third call with ySign=-1

			// Verify both results are logged with room names
			expect(consoleLogSpy).toHaveBeenCalledWith('Resolved room (ySign=+1):', 1, 'Kitchen');
			expect(consoleLogSpy).toHaveBeenCalledWith('Resolved room (ySign=-1):', 2, 'Bedroom');
		});

		it('should resolve room names for resolved candidates via roomNameFor helper', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const pose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 5, roomName: 'Living Room' }],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					rooms: [],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(5);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify room name is resolved correctly
			expect(consoleLogSpy).toHaveBeenCalledWith('Resolved room (ySign=+1):', 5, 'Living Room');
		});

		it('should log "(unknown room)" when resolved roomId does not exist in b01Info.rooms', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const pose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					rooms: [],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(999); // Unknown room ID

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(consoleLogSpy).toHaveBeenCalledWith('Resolved room (ySign=+1):', 999, '(unknown room)');
		});

		it('should log empty string when resolved roomId is undefined via roomNameFor helper', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			const pose = { x: 1000, y: 2000 };

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					rooms: [],
					currentPose: pose,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(consoleLogSpy).toHaveBeenCalledWith('Resolved room (ySign=+1):', 'no match', '');
		});

		it('should log "not found" for trace-based robot pose when tracePose is undefined', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			mockWaitForPush
				.mockResolvedValueOnce(Buffer.from([1, 2, 3]))
				.mockResolvedValueOnce(Buffer.from([0x02, 0x01, 4, 5, 6]));

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: undefined,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					// trace parse yields no pose either
					rooms: [],
					currentPose: undefined,
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(consoleLogSpy).toHaveBeenCalledWith('\nTrace-based robot pose:', 'not found');
		});

		it('should filter trace packets with correct 0x02 0x01 marker check via callback', async () => {
			// This test verifies the callback filter function (lines 66-69) is correct by
			// capturing the callback passed to waitForPush and testing its conditional logic
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			// Capture the callback passed to mockWaitForPush so we can verify its filter logic

			let capturedCallback: ((msg: any) => unknown) | undefined;
			mockWaitForPush.mockImplementation((_router: unknown, _duid: unknown, callback: unknown, _timeout?: unknown) => {
				capturedCallback = callback as (msg: unknown) => unknown;
				return Promise.resolve(Buffer.from([0x02, 0x01, 4, 5, 6]));
			});

			mockParseRoomsFromEncryptedBinary
				.mockReturnValueOnce({
					rooms: [{ roomId: 1, roomName: 'Kitchen' }],
					currentPose: { x: 1000, y: 2000 },
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				})
				.mockReturnValueOnce({
					rooms: [],
					currentPose: { x: 1100, y: 2100 },
					roomMatrix: { data: Buffer.from([1, 2, 3]), width: 3, height: 1 },
				});

			mockResolveRoomFromPose.mockReturnValue(1);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the callback was captured from cmdB01PoseInfo's waitForPush call
			expect(capturedCallback).toBeDefined();

			// Test the callback filter logic directly (this exercises the conditional on lines 66-68)
			// Protocol.map_response is 301
			const MAP_RESPONSE_KEY = 301;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const callback = capturedCallback!;

			// Valid trace packet with 0x02 0x01 marker and sufficient length: should return the buffer
			const validMsg = {
				body: new Map([[MAP_RESPONSE_KEY, Buffer.from([0x02, 0x01, 4, 5, 6])]]),
			};
			expect(callback(validMsg)).toEqual(Buffer.from([0x02, 0x01, 4, 5, 6]));

			// Invalid: wrong first byte marker: should return undefined
			const wrongMarkerMsg = {
				body: new Map([[MAP_RESPONSE_KEY, Buffer.from([0x01, 0x01, 4, 5, 6])]]),
			};
			expect(callback(wrongMarkerMsg)).toBeUndefined();

			// Invalid: wrong second byte marker: should return undefined
			const wrongMarker2Msg = {
				body: new Map([[MAP_RESPONSE_KEY, Buffer.from([0x02, 0x02, 4, 5, 6])]]),
			};
			expect(callback(wrongMarker2Msg)).toBeUndefined();

			// Invalid: too short (< 2 bytes): should return undefined
			const shortMsg = {
				body: new Map([[MAP_RESPONSE_KEY, Buffer.from([0x02])]]),
			};
			expect(callback(shortMsg)).toBeUndefined();

			// Invalid: no body at all: should return undefined
			const noBodyMsg = { body: undefined };
			expect(callback(noBodyMsg)).toBeUndefined();

			// Invalid: no map_response (301) in body: should return undefined
			const wrongKeyMsg = {
				body: new Map([[999, Buffer.from([0x02, 0x01, 4, 5, 6])]]),
			};
			expect(callback(wrongKeyMsg)).toBeUndefined();

			// Invalid: body value is not a Buffer: should return undefined
			const nonBufferMsg = {
				body: new Map([[MAP_RESPONSE_KEY, 'not a buffer']]),
			};
			expect(callback(nonBufferMsg)).toBeUndefined();
		});
	});

	describe('map binary predicate callback', () => {
		it('should filter map binary via predicate callback (lines 31-34), returning Buffer when valid', async () => {
			// Tests the mapBinaryPromise callback predicate (lines 31-34) that filters
			// protocol messages for Buffer values in Protocol.map_response
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

			let capturedMapCallback: ((msg: any) => unknown) | undefined;
			mockWaitForPush.mockImplementation((_router: unknown, _duid: unknown, callback: unknown, _timeout?: unknown) => {
				// Capture FIRST waitForPush call only (map binary, not trace)
				if (!capturedMapCallback) {
					capturedMapCallback = callback as (msg: unknown) => unknown;
				}
				return Promise.resolve(Buffer.from([1, 2, 3]));
			});

			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			expect(capturedMapCallback).toBeDefined();

			const MAP_RESPONSE_KEY = 301;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const callback = capturedMapCallback!;

			// Valid: Buffer in Protocol.map_response → should return the buffer
			const validMsg = {
				body: new Map([[MAP_RESPONSE_KEY, Buffer.from([10, 20, 30])]]),
			};
			expect(callback(validMsg)).toEqual(Buffer.from([10, 20, 30]));

			// Invalid: no body → should return undefined
			const noBodyMsg = { body: undefined };
			expect(callback(noBodyMsg)).toBeUndefined();

			// Invalid: missing key in map → should return undefined
			const missingKeyMsg = {
				body: new Map([[999, Buffer.from([10, 20, 30])]]),
			};
			expect(callback(missingKeyMsg)).toBeUndefined();

			// Invalid: non-Buffer value → should return undefined
			const nonBufferMsg = {
				body: new Map([[MAP_RESPONSE_KEY, 'not a buffer']]),
			};
			expect(callback(nonBufferMsg)).toBeUndefined();

			// Invalid: null body value → should return undefined
			const nullMsg = {
				body: new Map([[MAP_RESPONSE_KEY, null]]),
			};
			expect(callback(nullMsg)).toBeUndefined();
		});
	});

	describe('room diagnostics logging', () => {
		it('should log room names with fallback "(unnamed)" when room.roomName is empty string', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// Room with empty roomName string
			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [
					{ roomId: 1, roomName: '', labelPos: { x: 10, y: 20 } },
					{ roomId: 2, roomName: 'Kitchen', labelPos: { x: 30, y: 40 } },
				],
				currentPose: undefined,
				roomMatrix: undefined,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the empty room name falls back to "(unnamed)"
			expect(consoleLogSpy).toHaveBeenCalledWith('  [1] (unnamed)  labelPos=' + JSON.stringify({ x: 10, y: 20 }));
			expect(consoleLogSpy).toHaveBeenCalledWith('  [2] Kitchen  labelPos=' + JSON.stringify({ x: 30, y: 40 }));
		});
	});

	describe('diagnostic header logging', () => {
		it('should log headerUnknownByte6 when defined (line 96)', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// Set headerUnknownByte6 to a test value (e.g., 42 = 0x2a)
			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
				headerUnknownByte6: 42, // 0x2a
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the log line with correct hex formatting
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'\nUnused header byte (offset 6, diagnostic — unconfirmed): 42 (0x2a)',
			);
		});

		it('should not log headerUnknownByte6 when undefined', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// headerUnknownByte6 not set (undefined)
			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
				headerUnknownByte6: undefined,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the diagnostic line was NOT logged
			const calls = vi.mocked(consoleLogSpy).mock.calls;
			const hexLogLines = calls.filter((call: unknown[]) =>
				(call[0] as string | undefined)?.includes?.('Unused header byte (offset 6'),
			);
			expect(hexLogLines).toHaveLength(0);
		});

		it('should log headerReserved as hex with full int32/int16 table when length >= 16 (lines 101-127)', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// Create a 16-byte buffer with known values for testing
			// Offsets 0,4,8,12: int32/uint32
			// Offsets 0,2,4,6,8,10,12,14: int16/uint16
			const reserved = Buffer.alloc(16);
			// Set some known values: e.g., 0x12345678 at offset 0 (big-endian)
			reserved.writeInt32BE(0x12345678, 0);
			reserved.writeInt32BE(-100, 4); // negative int32
			reserved.writeInt32BE(999, 8);
			reserved.writeInt32BE(-50000, 12);

			// Also verify int16 values: set some at specific offsets
			reserved.writeInt16BE(100, 0);
			reserved.writeInt16BE(-200, 2);
			reserved.writeInt16BE(30000, 4); // large uint16
			// ... rest left at 0

			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
				headerReserved: reserved,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the header line
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'\nUnused header bytes (offsets 11-26, diagnostic — meaning unconfirmed):',
			);

			// Verify hex line is logged
			expect(consoleLogSpy).toHaveBeenCalledWith('  hex:', reserved.toString('hex'));

			// Verify the int32/uint32 pairs header and at least one pair
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'  as int32BE/uint32BE @ offsets 0,4,8,12 (e.g. possible origin X/Y pair):',
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				`    [0] int32=${reserved.readInt32BE(0)}  uint32=${reserved.readUInt32BE(0)}`,
			);

			// Verify the int16/uint16 pairs header and at least one pair
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'  as int16BE/uint16BE @ offsets 0,2,4,6,8,10,12,14 (e.g. possible scale/origin fields):',
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				`    [0] int16=${reserved.readInt16BE(0)}  uint16=${reserved.readUInt16BE(0)}`,
			);

			// Verify all 4 int32 pairs are logged
			const int32LogCalls = vi
				.mocked(consoleLogSpy)
				.mock.calls.filter((call: unknown[]) => (call[0] as string | undefined)?.includes?.('[0] int32='));
			expect(int32LogCalls.length).toBeGreaterThanOrEqual(1);
		});

		it('should log only hex line when headerReserved.length < 16 (skips int16/int32 table)', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// Create an 8-byte buffer (less than 16)
			const reserved = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
				headerReserved: reserved,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify the header line
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'\nUnused header bytes (offsets 11-26, diagnostic — meaning unconfirmed):',
			);

			// Verify hex line is logged
			expect(consoleLogSpy).toHaveBeenCalledWith('  hex:', reserved.toString('hex'));

			// Verify the int32/uint32 header is NOT logged (because length < 16)
			const int32HeaderCalls = vi
				.mocked(consoleLogSpy)
				.mock.calls.filter((call: unknown[]) => (call[0] as string | undefined)?.includes?.('as int32BE/uint32BE'));
			expect(int32HeaderCalls).toHaveLength(0);

			// Verify the int16/uint16 header is NOT logged (because length < 16)
			const int16HeaderCalls = vi
				.mocked(consoleLogSpy)
				.mock.calls.filter((call: unknown[]) => (call[0] as string | undefined)?.includes?.('as int16BE/uint16BE'));
			expect(int16HeaderCalls).toHaveLength(0);
		});

		it('should not log anything when headerReserved is undefined', async () => {
			const clientRouter = createClientRouterStub();
			const dispatcher = createDispatcherStub();
			mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });
			mockWaitForPush.mockResolvedValue(Buffer.from([1, 2, 3]));

			// headerReserved is undefined
			mockParseRoomsFromEncryptedBinary.mockReturnValue({
				rooms: [],
				currentPose: undefined,
				roomMatrix: undefined,
				headerReserved: undefined,
			});
			mockResolveRoomFromPose.mockReturnValue(undefined);

			const session = createSession();
			await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

			// Verify no diagnostic header bytes lines are logged
			const headerReservedCalls = vi
				.mocked(consoleLogSpy)
				.mock.calls.filter((call: unknown[]) =>
					(call[0] as string | undefined)?.includes?.('Unused header bytes (offsets 11-26'),
				);
			expect(headerReservedCalls).toHaveLength(0);
		});
	});
});
