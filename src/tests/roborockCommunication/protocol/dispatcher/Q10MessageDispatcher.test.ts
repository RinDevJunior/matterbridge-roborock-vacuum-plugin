import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { Q10RequestCode } from '../../../../roborockCommunication/enums/Q10RequestCode.js';
import { RequestMessage, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { Q10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.js';
import { asPartial, asType } from '../../../helpers/testUtils.js';

// --- Mock Factories ---
function createMockLogger() {
	return {
		notice: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};
}

function createMockClient() {
	return {
		send: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue(undefined),
		isConnected: vi.fn().mockReturnValue(true),
		connect: vi.fn(),
		disconnect: vi.fn(),
		registerConnectionListener: vi.fn(),
		registerMessageListener: vi.fn(),
	};
}

// --- Test Suite ---
describe('Q10MessageDispatcher', () => {
	let logger: ReturnType<typeof createMockLogger>;
	let client: ReturnType<typeof createMockClient>;
	let dispatcher: Q10MessageDispatcher;
	const duid = 'test-duid';

	beforeEach(() => {
		logger = createMockLogger();
		client = createMockClient();
		dispatcher = new Q10MessageDispatcher(asType(logger), asType(client));
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe('getNetworkInfo', () => {
		it('should return undefined', async () => {
			const result = await dispatcher.getNetworkInfo(duid);
			expect(result).toBeUndefined();
		});
	});

	describe('getSerialNumber', () => {
		it('should return the duid as serial number', async () => {
			const result = await dispatcher.getSerialNumber(duid);
			expect(result).toBe(duid);
		});
	});

	describe('getDeviceStatus', () => {
		it('should call client.send', async () => {
			await dispatcher.getDeviceStatus(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('getMapInfo', () => {
		it('should call client.send and return empty MapInfo', async () => {
			const result = await dispatcher.getMapInfo(duid);
			expect(client.send).toHaveBeenCalled();
			expect(client.query).not.toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should call client.send and return void when using V2', async () => {
			const result = await dispatcher.getMapInfoV2(duid);
			expect(client.send).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('getRoomMap', () => {
		it('should call client.send and return empty array', async () => {
			const result = await dispatcher.getRoomMap(duid, 1);
			expect(client.send).toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it('should call client.send and return void when using V2', async () => {
			const result = await dispatcher.getRoomMapV2(duid, 1);
			expect(client.send).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('goHome', () => {
		it('should send a charge command', async () => {
			await dispatcher.goHome(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('startCleaning', () => {
		it('should send a start cleaning command', async () => {
			await dispatcher.startCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('startRoomCleaning', () => {
		it('should send a start room cleaning command', async () => {
			await dispatcher.startRoomCleaning(duid, [1, 2], 2);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('pauseCleaning', () => {
		it('should send a pause command', async () => {
			await dispatcher.pauseCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('resumeCleaning', () => {
		it('should send a resume command', async () => {
			await dispatcher.resumeCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('resumeRoomCleaning', () => {
		it('should call resumeCleaning', async () => {
			const spy = vi.spyOn(dispatcher, 'resumeCleaning').mockResolvedValue(undefined);
			await dispatcher.resumeRoomCleaning(duid);
			expect(spy).toHaveBeenCalledWith(duid);
		});
	});

	describe('stopCleaning', () => {
		it('should send a stop command', async () => {
			await dispatcher.stopCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('findMyRobot', () => {
		it('should send a find_me command', async () => {
			await dispatcher.findMyRobot(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('sendCustomMessage', () => {
		it('should send a custom message', async () => {
			const def = asPartial<RequestMessage>({
				toLocalRequest: vi.fn(),
				secure: false,
				isForProtocol: vi.fn(),
				version: '1.0',
				method: 'custom',
			});
			await dispatcher.sendCustomMessage(duid, def);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('getCustomMessage', () => {
		it('should get a custom message', async () => {
			const def = asPartial<RequestMessage>({ dps: { foo: 'bar' } });
			await dispatcher.getCustomMessage(duid, def);
			expect(client.query).toHaveBeenCalled();
		});
	});

	describe('getCleanModeData', () => {
		it('should return a CleanModeSetting object', async () => {
			const result = await dispatcher.getCleanModeData(duid);
			expect(result).toEqual({ suctionPower: 0, waterFlow: 0, mopRoute: 0, distance_off: 0, sequenceType: 0 });
		});
	});

	describe('messageId', () => {
		it('should return monotonically increasing IDs', () => {
			const id1 = dispatcher['messageId'];
			const id2 = dispatcher['messageId'];
			expect(id2).toBeGreaterThan(id1);
		});

		it('should increment when Date.now returns same value', () => {
			const fixedTime = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
			dispatcher['lastB01Id'] = fixedTime;
			const id = dispatcher['messageId'];
			expect(id).toBe(fixedTime + 1);
			vi.restoreAllMocks();
		});
	});

	describe('changeCleanMode', () => {
		it('should call setCleanMode, setVacuumMode, setWaterMode as needed', async () => {
			const setCleanMode = vi.fn();
			const setVacuumMode = vi.fn();
			const setWaterMode = vi.fn();

			dispatcher['setCleanMode'] = setCleanMode;
			dispatcher['setVacuumMode'] = setVacuumMode;
			dispatcher['setWaterMode'] = setWaterMode;

			const setting = new CleanModeSetting(1, 2, 4, 3, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(setCleanMode).toHaveBeenCalledWith(duid, 1, 2);
			expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
			expect(setWaterMode).toHaveBeenCalledWith(duid, 2);
		});
		it('should not call setVacuumMode if suctionPower is 0', async () => {
			const setCleanMode = vi.fn();
			const setVacuumMode = vi.fn();
			const setWaterMode = vi.fn();

			dispatcher['setCleanMode'] = setCleanMode;
			dispatcher['setVacuumMode'] = setVacuumMode;
			dispatcher['setWaterMode'] = setWaterMode;

			const setting = new CleanModeSetting(0, 2, 4, 3, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(setVacuumMode).not.toHaveBeenCalled();
			expect(setWaterMode).toHaveBeenCalledWith(duid, 2);
		});
		it('should not call setWaterMode if waterFlow is 0', async () => {
			const setCleanMode = vi.fn();
			const setVacuumMode = vi.fn();
			const setWaterMode = vi.fn();

			dispatcher['setCleanMode'] = setCleanMode;
			dispatcher['setVacuumMode'] = setVacuumMode;
			dispatcher['setWaterMode'] = setWaterMode;

			const setting = new CleanModeSetting(1, 0, 4, 3, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(setVacuumMode).toHaveBeenCalledWith(duid, 1);
			expect(setWaterMode).not.toHaveBeenCalled();
		});

		it('should call real private helpers and send commands via client', async () => {
			const setting = new CleanModeSetting(2, 3, 4, 1, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			// setCleanMode + setVacuumMode + setWaterMode = 3 sends
			expect(client.send).toHaveBeenCalledTimes(3);
			expect(logger.notice).toHaveBeenCalledWith(expect.stringContaining('Change clean mode'));
		});

		it('should only call setCleanMode when both suctionPower and waterFlow are 0', async () => {
			const setting = new CleanModeSetting(0, 0, 4, 1, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(client.send).toHaveBeenCalledTimes(1);
		});
	});

	describe('getConsumableStatus', () => {
		it('should return filterConditionPercent when DP 127 is present in the push', async () => {
			// Arrange
			client.query.mockResolvedValue(42);

			// Act
			const result = await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(result).toEqual({ filterConditionPercent: 42 });
		});

		it('should round a non-integer DP 127 value to the nearest integer', async () => {
			// Arrange
			client.query.mockResolvedValue(67.6);

			// Act
			const result = await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(result).toEqual({ filterConditionPercent: 68 });
		});

		it('should clamp an out-of-range DP 127 value above 100 down to 100', async () => {
			// Arrange
			client.query.mockResolvedValue(150);

			// Act
			const result = await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(result).toEqual({ filterConditionPercent: 100 });
		});

		it('should clamp a negative DP 127 value up to 0', async () => {
			// Arrange
			client.query.mockResolvedValue(-5);

			// Act
			const result = await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(result).toEqual({ filterConditionPercent: 0 });
		});

		it('should return undefined without throwing when DP 127 is absent from the push', async () => {
			// Arrange
			client.query.mockResolvedValue(undefined);

			// Act
			const result = await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(result).toBeUndefined();
		});

		it('should send a dps_request trigger with a messageId via client.query', async () => {
			// Arrange
			client.query.mockResolvedValue(10);

			// Act
			await dispatcher.getConsumableStatus(duid);

			// Assert
			expect(client.query).toHaveBeenCalledWith(
				duid,
				expect.objectContaining({ messageId: expect.any(Number), dps: { [Q10RequestCode.dps_request]: 1 } }),
				expect.any(Function),
			);
		});

		it('should resolve filter_life from msg.body when used as the query parseFn', async () => {
			// Arrange
			client.query.mockResolvedValue(undefined);
			await dispatcher.getConsumableStatus(duid);
			const parseFn = asType<(msg: ResponseMessage) => unknown>(vi.mocked(client.query).mock.calls[0]?.[2]);
			const get = vi.fn().mockReturnValue(73);
			const message = asType<ResponseMessage>({ body: { get } });

			// Act
			const parsed = parseFn(message);

			// Assert
			expect(parsed).toBe(73);
			expect(get).toHaveBeenCalledWith(Q10RequestCode.filter_life);
		});

		it('should return undefined from the parseFn when the response has no body', async () => {
			// Arrange
			client.query.mockResolvedValue(undefined);
			await dispatcher.getConsumableStatus(duid);
			const parseFn = asType<(msg: ResponseMessage) => unknown>(vi.mocked(client.query).mock.calls[0]?.[2]);

			// Act
			const parsed = parseFn(asType<ResponseMessage>({ body: undefined }));

			// Assert
			expect(parsed).toBeUndefined();
		});

		it('should return undefined from the parseFn when DP 127 is not a number', async () => {
			// Arrange
			client.query.mockResolvedValue(undefined);
			await dispatcher.getConsumableStatus(duid);
			const parseFn = asType<(msg: ResponseMessage) => unknown>(vi.mocked(client.query).mock.calls[0]?.[2]);

			// Act
			const parsed = parseFn(asType<ResponseMessage>({ body: { get: vi.fn().mockReturnValue('abc') } }));

			// Assert
			expect(parsed).toBeUndefined();
		});
	});

	describe('resetFilterConsumable', () => {
		it('should send DP 22 reset_filter with value 1 via client.send', async () => {
			// Arrange
			const expectedDps = { [Q10RequestCode.reset_filter]: 1 };

			// Act
			await dispatcher.resetFilterConsumable(duid);

			// Assert
			expect(client.send).toHaveBeenCalledTimes(1);
			expect(client.send).toHaveBeenCalledWith(
				duid,
				expect.objectContaining({ messageId: expect.any(Number), dps: expectedDps }),
			);
		});

		it('should not call client.query because the reset is fire-and-forget', async () => {
			// Arrange
			// (no additional setup needed; client is fresh per test)

			// Act
			await dispatcher.resetFilterConsumable(duid);

			// Assert
			expect(client.query).not.toHaveBeenCalled();
		});
	});
});
