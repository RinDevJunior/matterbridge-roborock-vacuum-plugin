import { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { V10MessageDispatcher } from '../../../roborockCommunication/protocol/dispatcher/V10MessageDispatcher.js';
import { asType } from '../../testUtils.js';

describe('V10MessageDispatcher', () => {
	let mockClient: Record<string, ReturnType<typeof vi.fn>>;
	let processor: V10MessageDispatcher;
	let mockLogger: AnsiLogger;

	beforeEach(() => {
		mockClient = {
			registerMessageListener: vi.fn(),
			registerConnectionListener: vi.fn(),
			isConnected: vi.fn().mockReturnValue(true),
			isReady: vi.fn().mockReturnValue(true),
			connect: vi.fn(),
			disconnect: vi.fn().mockResolvedValue(undefined),
			get: vi.fn(),
			query: vi.fn().mockResolvedValue(undefined),
			send: vi.fn(),
		};
		mockLogger = asType<AnsiLogger>({
			debug: vi.fn(),
			notice: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		});

		processor = new V10MessageDispatcher(mockLogger, asType(mockClient));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('getNetworkInfo should call client.query', async () => {
		await processor.getNetworkInfo('duid');
		expect(mockClient.query).toHaveBeenCalledWith('duid', expect.any(Object), expect.any(Function));
	});

	it('getDeviceStatus should call client.send', async () => {
		await processor.getDeviceStatus('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('gotoDock should call client.send', async () => {
		await processor.goHome('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('startClean should call client.send', async () => {
		await processor.startCleaning('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('startRoomClean should call client.send with correct params', async () => {
		await processor.startRoomCleaning('duid', [1, 2], 3);
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('pauseClean should call client.send', async () => {
		await processor.pauseCleaning('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('resumeClean should call client.send', async () => {
		await processor.resumeCleaning('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('stopClean should call client.send', async () => {
		await processor.stopCleaning('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('sendCustomMessage should call client.send', async () => {
		const def = { method: 'custom' };
		await processor.sendCustomMessage('duid', asType(def));
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('getCustomMessage should call client.query', async () => {
		const def = { method: 'custom' };
		await processor.getCustomMessage('duid', asType(def));
		expect(mockClient.query).toHaveBeenCalled();
	});

	it('findMyRobot should call client.send', async () => {
		await processor.findMyRobot('duid');
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.any(Object));
	});

	it('getCleanModeData should parse and return correct values', async () => {
		mockClient.query
			.mockResolvedValueOnce([306]) // get_mop_mode
			.mockResolvedValueOnce([101]) // get_custom_mode
			.mockResolvedValueOnce({ water_box_mode: 207, distance_off: 5 }); // get_water_box_custom_mode

		const result = await processor.getCleanModeData('duid');
		expect(result).toEqual({ suctionPower: 101, waterFlow: 207, distance_off: 5, mopRoute: 306 });
	});

	it('getCleanModeData should handle array responses for suctionPower', async () => {
		mockClient.query.mockResolvedValueOnce([306]).mockResolvedValueOnce([101]).mockResolvedValueOnce([207]);

		const result = await processor.getCleanModeData('duid');
		expect(result.suctionPower).toBe(101);
		expect(result.mopRoute).toBe(306);
	});

	it('getCleanModeData should handle non-array responses', async () => {
		mockClient.query.mockResolvedValueOnce(306).mockResolvedValueOnce(101).mockResolvedValueOnce(207);

		const result = await processor.getCleanModeData('duid');
		expect(result.suctionPower).toBe(101);
		expect(result.waterFlow).toBe(207);
		expect(result.mopRoute).toBe(306);
	});

	it('getCleanModeData should extract distance_off from object response', async () => {
		mockClient.query
			.mockResolvedValueOnce([306])
			.mockResolvedValueOnce([101])
			.mockResolvedValueOnce({ water_box_mode: 207, distance_off: 10 });

		const result = await processor.getCleanModeData('duid');
		expect(result.distance_off).toBe(10);
		expect(result.waterFlow).toBe(207);
	});

	it('getCleanModeData should handle object without distance_off', async () => {
		mockClient.query
			.mockResolvedValueOnce([306])
			.mockResolvedValueOnce([101])
			.mockResolvedValueOnce({ water_box_mode: 207 });

		const result = await processor.getCleanModeData('duid');
		expect(result.distance_off).toBe(0);
		expect(result.waterFlow).toBe(207);
	});

	it('changeCleanMode should call logger.notice', async () => {
		const setting = new CleanModeSetting(101, 207, 5, 306, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockLogger.notice).toHaveBeenCalled();
	});

	it('changeCleanMode should not send initial set_mop_mode(custom) if mopRoute is smart (306)', async () => {
		const setting = new CleanModeSetting(0, 0, 0, 306, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		const guardCall = mockClient.send.mock.calls.find(
			(c: unknown[]) =>
				(c[1] as { method: string }).method === 'set_mop_mode' &&
				JSON.stringify((c[1] as { params: unknown[] }).params) === JSON.stringify([302]),
		);
		expect(guardCall).toBeUndefined();
	});

	it('changeCleanMode should send initial set_mop_mode(custom=302) if mopRoute is not smart and not 0', async () => {
		const setting = new CleanModeSetting(0, 0, 0, 303, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).toHaveBeenCalledWith(
			'duid',
			expect.objectContaining({ method: 'set_mop_mode', params: [302] }),
		);
	});

	it('changeCleanMode should set suctionPower if non-zero', async () => {
		const setting = new CleanModeSetting(101, 0, 0, 303, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).toHaveBeenCalledWith('duid', expect.objectContaining({ method: 'set_custom_mode' }));
	});

	it('changeCleanMode should set water_box_custom_mode with distance_off for CustomizeWithDistanceOff', async () => {
		const setting = new CleanModeSetting(0, 207, 5, 0, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).toHaveBeenCalledWith(
			'duid',
			expect.objectContaining({
				method: 'set_water_box_custom_mode',
				params: { water_box_mode: 207, distance_off: 5 },
			}),
		);
	});

	it('changeCleanMode should set water_box_custom_mode without distance_off for other modes', async () => {
		const setting = new CleanModeSetting(0, 200, 0, 0, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).toHaveBeenCalledWith(
			'duid',
			expect.objectContaining({ method: 'set_water_box_custom_mode', params: [200] }),
		);
	});

	it('changeCleanMode should set mopRoute if non-zero', async () => {
		const setting = new CleanModeSetting(0, 0, 0, 303, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).toHaveBeenCalledWith(
			'duid',
			expect.objectContaining({ method: 'set_mop_mode', params: [303] }),
		);
	});

	it('changeCleanMode should not send if all params are zero', async () => {
		const setting = new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist);
		await processor.changeCleanMode('duid', setting);
		expect(mockClient.send).not.toHaveBeenCalled();
	});
});
