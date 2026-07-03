import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockLogger } from '../helpers/testUtils.js';

// Mock all module boundaries cmdB01PoseInfo touches, following this project's convention of
// vi.mock at module boundaries for CLI command isolation testing (see mapListHelpers.test.ts /
// broadcast client tests for the vi.mock pattern used elsewhere in this suite).
const mockConnectDevice = vi.fn();
const mockWaitForPush = vi.fn();
const mockParseRoomsFromEncryptedBinary = vi.fn();
const mockResolveRoomFromPose = vi.fn();

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
			roomMatrix: { data: Buffer.from([1, 2, 3]) },
		});
		mockResolveRoomFromPose.mockReturnValue(undefined);

		const session = createSession();
		await expect(cmdB01PoseInfo('duid-1', session, logger)).resolves.toBeUndefined();

		expect(consoleLogSpy).toHaveBeenCalledWith(
			'Resolved room:',
			'could not determine — roomMatrix decoding not yet implemented, pending real-device capture',
		);
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
});
