import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Q7RequestCode, Q7RequestMethod } from '../../../../../roborockCommunication/enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../../../roborockCommunication/enums/Q10RequestCode.js';
import { ResponseBody, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { AbstractMessageHandler } from '../../../../../roborockCommunication/routing/handlers/abstractMessageHandler.js';
import { B01StatusListener } from '../../../../../roborockCommunication/routing/listeners/implementation/b01StatusListener.js';
import { asPartial, asType, createMockLogger } from '../../../../helpers/testUtils.js';

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

function makeQ10Message(duid: string, body: Record<number, unknown>): ResponseMessage {
	return asPartial<ResponseMessage>({
		duid,
		body: new ResponseBody(asType(body)),
	});
}

function makeQ7Message(
	duid: string,
	data: Record<string, unknown>,
	method = Q7RequestMethod.get_prop,
): ResponseMessage {
	const envelope = JSON.stringify({ method, data });
	return asPartial<ResponseMessage>({
		duid,
		body: new ResponseBody(asPartial({ [Q7RequestCode.query_response]: envelope })),
	});
}

describe('B01StatusListener', () => {
	const duid = 'test-duid';
	let listener: B01StatusListener;
	let handler: AbstractMessageHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		listener = new B01StatusListener(duid, createMockLogger());
		handler = createMockHandler();
	});

	describe('onMessage — guard conditions', () => {
		it('ignores messages from other duids', async () => {
			listener.registerHandler(handler);
			const msg = makeQ10Message('other-duid', { [Q10RequestCode.battery]: 80 });
			await listener.onMessage(msg);
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('does nothing when no handler registered', async () => {
			const msg = makeQ10Message(duid, { [Q10RequestCode.battery]: 80 });
			await listener.onMessage(msg);
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});

		it('does nothing when message has no body', async () => {
			listener.registerHandler(handler);
			const msg = asPartial<ResponseMessage>({ duid, body: undefined });
			await listener.onMessage(msg);
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
		});
	});

	describe('tryHandleQ10Push', () => {
		beforeEach(() => {
			listener.registerHandler(handler);
		});

		describe('error_code', () => {
			it('calls handler.onError with error code', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.error_code]: 5 });
				await listener.onMessage(msg);
				expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ vacuumErrorCode: 5 }));
			});
		});

		describe('state', () => {
			it('calls handler.onStatusChanged with mapped state', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.state]: 3 });
				await listener.onMessage(msg);
				expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 3 }));
			});

			it('stores lastState for subsequent battery messages', async () => {
				await listener.onMessage(makeQ10Message(duid, { [Q10RequestCode.state]: 8 }));
				await listener.onMessage(makeQ10Message(duid, { [Q10RequestCode.battery]: 70 }));
				expect(handler.onBatteryUpdate).toHaveBeenCalledWith(
					expect.objectContaining({ deviceStatus: 8, percentage: 70 }),
				);
			});
		});

		describe('battery', () => {
			it('calls handler.onBatteryUpdate with battery level', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.battery]: 75 });
				await listener.onMessage(msg);
				expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 75 }));
			});
		});

		describe('charge_status', () => {
			it('calls handler.onBatteryUpdate with charge status', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.charge_status]: 2 });
				await listener.onMessage(msg);
				expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ chargeStatus: 2 }));
			});
		});

		describe('fan_power', () => {
			it('calls handler.onCleanModeUpdate with mapped suction power (q10FanPowerToV1)', async () => {
				// wire=3 → V1=103
				const msg = makeQ10Message(duid, { [Q10RequestCode.fan_power]: 3 });
				await listener.onMessage(msg);
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 103 }));
			});
		});

		describe('water_box_mode', () => {
			it('calls handler.onCleanModeUpdate with mapped water flow (q10WaterModeToV1)', async () => {
				// wire=2 → V1=202
				const msg = makeQ10Message(duid, { [Q10RequestCode.water_box_mode]: 2 });
				await listener.onMessage(msg);
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ waterFlow: 202 }));
			});
		});

		describe('fanPower + waterBoxMode together', () => {
			it('emits single onCleanModeUpdate', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.fan_power]: 2,
					[Q10RequestCode.water_box_mode]: 1,
				});
				await listener.onMessage(msg);
				expect(handler.onCleanModeUpdate).toHaveBeenCalledTimes(1);
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(
					expect.objectContaining({ suctionPower: 102, waterFlow: 201 }),
				);
			});
		});

		describe('clean_area / clean_time / clean_task_type', () => {
			it('calls handler.onServiceAreaUpdate when clean_area present', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.clean_area]: 500 });
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(expect.objectContaining({ duid }));
			});

			it('calls handler.onServiceAreaUpdate when clean_time present', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.clean_time]: 120 });
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(expect.objectContaining({ duid }));
			});

			it('calls handler.onServiceAreaUpdate when clean_task_type present', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.clean_task_type]: 1 });
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(expect.objectContaining({ duid }));
			});

			it('skips onServiceAreaUpdate when none present', async () => {
				const msg = makeQ10Message(duid, { [Q10RequestCode.battery]: 50 });
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).not.toHaveBeenCalled();
			});
		});
	});

	describe('tryHandleQ7Response', () => {
		beforeEach(() => {
			listener.registerHandler(handler);
		});

		it('ignores body without key 10001', async () => {
			const msg = asPartial<ResponseMessage>({
				duid,
				body: new ResponseBody(asPartial({ 99: 'something' })),
			});
			await listener.onMessage(msg);
			expect(handler.onStatusChanged).not.toHaveBeenCalled();
		});

		it('ignores Q7 message with unknown method', async () => {
			const envelope = JSON.stringify({ method: 'unknown.method', data: { status: 3 } });
			const msg = asPartial<ResponseMessage>({
				duid,
				body: new ResponseBody(asPartial({ [Q7RequestCode.query_response]: envelope })),
			});
			await listener.onMessage(msg);
			expect(handler.onStatusChanged).not.toHaveBeenCalled();
		});

		it('handles prop.get method', async () => {
			const msg = makeQ7Message(duid, { status: 3 }, Q7RequestMethod.get_prop);
			await listener.onMessage(msg);
			expect(handler.onStatusChanged).toHaveBeenCalled();
		});

		it('handles prop.post method', async () => {
			const msg = makeQ7Message(duid, { status: 5 }, 'prop.post' as Q7RequestMethod);
			await listener.onMessage(msg);
			expect(handler.onStatusChanged).toHaveBeenCalled();
		});

		it('logs warning on malformed JSON and does not throw', async () => {
			const mockLogger = createMockLogger();
			const newListener = new B01StatusListener(duid, mockLogger);
			newListener.registerHandler(handler);
			const msg = asPartial<ResponseMessage>({
				duid,
				body: new ResponseBody(asPartial({ [Q7RequestCode.query_response]: '{invalid json}' })),
			});
			await expect(newListener.onMessage(msg)).resolves.toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to parse'));
		});
	});

	describe('handleQ7Props', () => {
		beforeEach(() => {
			listener.registerHandler(handler);
		});

		describe('fault', () => {
			it('calls handler.onError with fault code', async () => {
				const msg = makeQ7Message(duid, { fault: 7 });
				await listener.onMessage(msg);
				expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ vacuumErrorCode: 7 }));
			});
		});

		describe('status', () => {
			it('calls handler.onStatusChanged with status', async () => {
				const msg = makeQ7Message(duid, { status: 4 });
				await listener.onMessage(msg);
				expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 4 }));
			});
		});

		describe('quantity (battery)', () => {
			it('calls handler.onBatteryUpdate', async () => {
				const msg = makeQ7Message(duid, { quantity: 90 });
				await listener.onMessage(msg);
				expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 90 }));
			});
		});

		describe('wind (suction power)', () => {
			it('converts wind=1 → 101', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 1 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 101 }));
			});

			it('converts wind=2 → 102', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 2 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 102 }));
			});

			it('converts wind=3 → 103', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 3 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 103 }));
			});

			it('converts wind=4 → 104', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 4 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 104 }));
			});

			it('converts wind=5 → 108', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 5 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 108 }));
			});

			it('converts unknown wind → 105 (default)', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 99 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ suctionPower: 105 }));
			});
		});

		describe('water (water flow)', () => {
			it('converts water to V1 range via q7WaterToV1', async () => {
				// wire=2 → V1=202
				await listener.onMessage(makeQ7Message(duid, { water: 2 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(expect.objectContaining({ waterFlow: 202 }));
			});
		});

		describe('clean mode update from Q7', () => {
			it('emits onCleanModeUpdate when wind present', async () => {
				await listener.onMessage(makeQ7Message(duid, { wind: 3 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledTimes(1);
			});

			it('emits onCleanModeUpdate when water present', async () => {
				await listener.onMessage(makeQ7Message(duid, { water: 1 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledTimes(1);
			});

			it('emits onCleanModeUpdate when mode present', async () => {
				await listener.onMessage(makeQ7Message(duid, { mode: 2 }));
				expect(handler.onCleanModeUpdate).toHaveBeenCalledTimes(1);
			});
		});

		describe('cleaning_area / cleaning_time', () => {
			it('calls handler.onServiceAreaUpdate with scaled values (*100 area, *60 time)', async () => {
				const msg = makeQ7Message(duid, { cleaning_area: 10, cleaning_time: 5 });
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({
							clean_area: 1000, // 10 * 100
							clean_time: 300, // 5 * 60
						}),
					}),
				);
			});
		});
	});
});
