import { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DockErrorCode,
	OperationStatusCode,
	VacuumErrorCode,
} from '../../../../../roborockCommunication/enums/index.js';
import { ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { AbstractMessageHandler } from '../../../../../roborockCommunication/routing/handlers/abstractMessageHandler.js';
import { V1StatusListener } from '../../../../../roborockCommunication/routing/listeners/implementation/v1StatusListener.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';

function createMockHandler(): AbstractMessageHandler {
	return asPartial<AbstractMessageHandler>({
		onBatteryUpdate: vi.fn().mockResolvedValue(undefined),
		onStatusChanged: vi.fn().mockResolvedValue(undefined),
		onCleanModeUpdate: vi.fn().mockResolvedValue(undefined),
		onServiceAreaUpdate: vi.fn().mockResolvedValue(undefined),
		onError: vi.fn().mockResolvedValue(undefined),
		onAdditionalProps: vi.fn().mockResolvedValue(undefined),
	});
}

function makeRpcResponseMessage(duid: string, resultBody: Record<string, unknown>) {
	return asPartial<ResponseMessage>({
		duid,
		isForProtocols: vi.fn().mockReturnValue(true),
		isSimpleOkResponse: vi.fn().mockReturnValue(false),
		get: vi.fn().mockReturnValue({ result: [resultBody] }),
	});
}

const baseResultBody: Record<string, unknown> = {
	state: OperationStatusCode.Idle,
	battery: 80,
	charge_status: 8,
	error_code: VacuumErrorCode.None,
	dock_error_status: DockErrorCode.None,
	in_cleaning: 0,
	in_returning: 0,
	in_fresh_state: 0,
	is_locating: 0,
	is_exploring: 0,
	in_warmup: 0,
	fan_power: 102,
	water_box_mode: 203,
	distance_off: 25,
	mop_mode: 300,
	seq_type: 0,
};

describe('V1StatusListener', () => {
	let logger: AnsiLogger;
	let listener: V1StatusListener;
	let handler: AbstractMessageHandler;
	const duid = 'test-duid';

	beforeEach(() => {
		logger = createMockLogger();
		listener = new V1StatusListener(duid, logger);
		handler = createMockHandler();
	});

	describe('constructor', () => {
		it('should set name and duid correctly', () => {
			expect(listener.name).toBe('V1StatusListener');
			expect(listener.duid).toBe(duid);
		});
	});

	describe('registerHandler', () => {
		it('should register a handler and allow message processing', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, baseResultBody);
			await listener.onMessage(message);
			expect(handler.onBatteryUpdate).toHaveBeenCalled();
		});
	});

	describe('onMessage - early returns', () => {
		it('should log debug and return early when DUID does not match', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid: 'different-duid',
				isForProtocols: vi.fn(),
				isSimpleOkResponse: vi.fn(),
				get: vi.fn(),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('does not match'));
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should log error and return early when no handler is registered', async () => {
			const message = makeRpcResponseMessage(duid, baseResultBody);
			await listener.onMessage(message);
			expect(logger.error).toHaveBeenCalledWith('[V1StatusListener]: No handler registered');
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should log debug and return early when message is not for correct protocols', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(false),
				isSimpleOkResponse: vi.fn(),
				get: vi.fn(),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('not for general_request or rpc_response'));
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should log debug and return early for simple OK response', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(true),
				get: vi.fn(),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Ignoring simple 'ok' response"));
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should log debug and return early when no rpc_response data', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue(null),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('No rpc_response data'));
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should return early when result array is empty', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue({ result: [] }),
			});
			await listener.onMessage(message);
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should return early when result is not an array', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue({ result: 'not-an-array' }),
			});
			await listener.onMessage(message);
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should return early when result[0] is a primitive number (not an object)', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue({ result: [104] }),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith('[V1StatusListener]: result[0] is not an object, skipping');
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should return early when result[0] is null', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue({ result: [null] }),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith('[V1StatusListener]: result[0] is not an object, skipping');
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('should log debug and return early when message does not contain state', async () => {
			listener.registerHandler(handler);
			const message = asPartial<ResponseMessage>({
				duid,
				isForProtocols: vi.fn().mockReturnValue(true),
				isSimpleOkResponse: vi.fn().mockReturnValue(false),
				get: vi.fn().mockReturnValue({ result: [{ battery: 80 }] }),
			});
			await listener.onMessage(message);
			expect(logger.debug).toHaveBeenCalledWith('[V1StatusListener]: Message does not contain state');
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});
	});

	describe('onMessage - successful processing', () => {
		it('should call all handlers when message is valid and no errors', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, baseResultBody);
			await listener.onMessage(message);
			expect(handler.onBatteryUpdate).toHaveBeenCalled();
			expect(handler.onStatusChanged).toHaveBeenCalled();
			expect(handler.onCleanModeUpdate).toHaveBeenCalled();
			expect(handler.onServiceAreaUpdate).toHaveBeenCalled();
			expect(handler.onError).toHaveBeenCalledWith(
				expect.objectContaining({
					vacuumErrorCode: VacuumErrorCode.None,
					dockErrorCode: DockErrorCode.None,
				}),
			);
		});

		it('should call onError when vacuum error code is non-zero', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				error_code: VacuumErrorCode.LidarBlocked,
			});
			await listener.onMessage(message);
			expect(handler.onError).toHaveBeenCalled();
			expect(handler.onBatteryUpdate).toHaveBeenCalled();
		});

		it('should call onError when dock error code is non-zero', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				dock_error_status: DockErrorCode.WaterEmpty,
			});
			await listener.onMessage(message);
			expect(handler.onError).toHaveBeenCalled();
		});

		it('should process message with cleaning_info', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				state: OperationStatusCode.Cleaning,
				cleaning_info: { fan_power: 102, water_box_status: 203, mop_mode: 300, segment_id: 4 },
			});
			await listener.onMessage(message);
			expect(handler.onBatteryUpdate).toHaveBeenCalled();
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					duid,
					state: OperationStatusCode.Cleaning,
				}),
			);
		});

		it('should process boolean flags from in_cleaning, in_returning, etc.', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				state: OperationStatusCode.Cleaning,
				in_cleaning: 1,
				in_returning: 0,
				in_fresh_state: 1,
				is_locating: 0,
				is_exploring: 1,
				in_warmup: 0,
			});
			await listener.onMessage(message);
			expect(handler.onStatusChanged).toHaveBeenCalledWith(
				expect.objectContaining({
					inCleaning: true,
					inReturning: false,
					inFreshState: true,
					isLocating: false,
					isExploring: true,
					inWarmup: false,
				}),
			);
		});

		it('should use cleaning_info fan_power when present', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				fan_power: 102,
				cleaning_info: { fan_power: 200, water_box_status: 250, mop_mode: 300 },
			});
			await listener.onMessage(message);
			expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ suctionPower: 200, waterFlow: 250 }),
			);
		});

		it('should forward clean_percent in cleaningProcess when present on status body', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				state: OperationStatusCode.Cleaning,
				clean_area: 100,
				clean_time: 60,
				clean_percent: 30,
			});
			await listener.onMessage(message);
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 30 },
				}),
			);
		});

		it('should omit clean_percent from cleaningProcess when absent on status body', async () => {
			listener.registerHandler(handler);
			const message = makeRpcResponseMessage(duid, {
				...baseResultBody,
				state: OperationStatusCode.Cleaning,
				clean_area: 50,
				clean_time: 30,
			});
			await listener.onMessage(message);

			const serviceAreaCall = vi.mocked(handler.onServiceAreaUpdate).mock.calls[0]?.[0];
			expect(serviceAreaCall?.cleaningProcess).toEqual({ clean_area: 50, clean_time: 30 });
			expect(serviceAreaCall?.cleaningProcess).not.toHaveProperty('clean_percent');
		});

		it('should not call onError when error_code, dock_error_status, and dss fields are absent entirely', async () => {
			listener.registerHandler(handler);
			const bodyWithoutErrorFields = {
				state: OperationStatusCode.Idle,
				battery: 80,
				charge_status: 8,
				in_cleaning: 0,
				in_returning: 0,
				in_fresh_state: 0,
				is_locating: 0,
				is_exploring: 0,
				in_warmup: 0,
				fan_power: 102,
				water_box_mode: 203,
				distance_off: 25,
				mop_mode: 300,
				seq_type: 0,
				// Intentionally omitting: error_code, dock_error_status, dss
			};
			const message = makeRpcResponseMessage(duid, bodyWithoutErrorFields);
			await listener.onMessage(message);
			expect(handler.onError).not.toHaveBeenCalled();
			expect(handler.onBatteryUpdate).toHaveBeenCalled();
		});

		it('should call onError twice when error transitions from non-zero to zero in sequential messages', async () => {
			listener.registerHandler(handler);

			// First message with non-zero vacuum error
			const messageWithError = makeRpcResponseMessage(duid, {
				...baseResultBody,
				error_code: VacuumErrorCode.LidarBlocked,
			});
			await listener.onMessage(messageWithError);
			expect(handler.onError).toHaveBeenCalledTimes(1);
			expect(vi.mocked(handler.onError).mock.calls[0]?.[0]).toMatchObject({
				vacuumErrorCode: VacuumErrorCode.LidarBlocked,
			});

			vi.clearAllMocks();

			// Second message with error cleared to zero
			const messageCleared = makeRpcResponseMessage(duid, baseResultBody);
			await listener.onMessage(messageCleared);
			expect(handler.onError).toHaveBeenCalledTimes(1);
			expect(vi.mocked(handler.onError).mock.calls[0]?.[0]).toMatchObject({
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
			});
		});
	});
});
