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

		describe('room_id_list / cleaningInfo (currentArea fix)', () => {
			it('should trigger onServiceAreaUpdate with segment_id when only room_id_list present', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [5],
						},
					},
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningInfo: expect.objectContaining({ segment_id: 5 }),
					}),
				);
			});

			it('should set cleaningInfo with segment_id when room_id_list present alongside clean_area', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 500,
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [7],
						},
					},
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({ clean_area: 500 }),
						cleaningInfo: expect.objectContaining({ segment_id: 7 }),
					}),
				);
			});

			it('should set cleaningInfo to undefined when room_id_list never received', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 300,
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({ clean_area: 300 }),
						cleaningInfo: undefined,
					}),
				);
			});

			it('should persist lastRoomId across multiple messages (sticky cache)', async () => {
				// First message: set room_id_list
				const msg1 = makeQ10Message(duid, {
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [5],
						},
					},
				});
				await listener.onMessage(msg1);

				// Second message: only clean_time, no room_id_list
				const msg2 = makeQ10Message(duid, {
					[Q10RequestCode.clean_time]: 120,
				});
				await listener.onMessage(msg2);

				// Verify both calls have segment_id: 5
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledTimes(2);
				expect(handler.onServiceAreaUpdate).toHaveBeenNthCalledWith(
					2,
					expect.objectContaining({
						cleaningInfo: expect.objectContaining({ segment_id: 5 }),
					}),
				);
			});

			it('should update lastRoomId when room_id_list changes mid-session', async () => {
				// First message: set room_id_list to 5
				const msg1 = makeQ10Message(duid, {
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [5],
						},
					},
				});
				await listener.onMessage(msg1);

				// Second message: change room_id_list to 8
				const msg2 = makeQ10Message(duid, {
					[Q10RequestCode.clean_time]: 200,
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [8],
						},
					},
				});
				await listener.onMessage(msg2);

				// Verify second call has segment_id: 8 (not 5)
				expect(handler.onServiceAreaUpdate).toHaveBeenNthCalledWith(
					2,
					expect.objectContaining({
						cleaningInfo: expect.objectContaining({ segment_id: 8 }),
					}),
				);
			});

			it('should not throw when common_request is not an object', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 200,
					[Q10RequestCode.common_request]: 12345, // not an object
				});
				await expect(listener.onMessage(msg)).resolves.toBeUndefined();
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningInfo: undefined,
					}),
				);
			});

			it('should not throw when clean_expand key is missing', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 150,
					[Q10RequestCode.common_request]: {
						// clean_expand key missing
						other_key: { room_id_list: [5] },
					},
				});
				await expect(listener.onMessage(msg)).resolves.toBeUndefined();
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningInfo: undefined,
					}),
				);
			});

			it('should not throw and leave cleaningInfo undefined when room_id_list is empty array', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 100,
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [], // empty array
						},
					},
				});
				await expect(listener.onMessage(msg)).resolves.toBeUndefined();
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningInfo: undefined,
					}),
				);
			});

			it('should use first entry when room_id_list has multiple entries', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [5, 8, 12],
						},
					},
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningInfo: expect.objectContaining({ segment_id: 5 }),
					}),
				);
			});

			it('should not throw when clean_expand is not an object', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 250,
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: 'not-an-object',
					},
				});
				await expect(listener.onMessage(msg)).resolves.toBeUndefined();
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningInfo: undefined,
					}),
				);
			});
		});

		describe('clean_percent (DP 87) — addendum', () => {
			it('should set cleaningProcess.clean_percent when clean_progress present', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_progress]: 42,
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({ clean_percent: 42 }),
					}),
				);
			});

			it('should trigger onServiceAreaUpdate when clean_progress alone present', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_progress]: 55,
				});
				await listener.onMessage(msg);
				// This was the gap: clean_progress alone should trigger the update
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledTimes(1);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({ clean_percent: 55 }),
					}),
				);
			});

			it('should set cleaningProcess.clean_percent to undefined when absent', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_area]: 300,
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningProcess: expect.objectContaining({ clean_percent: undefined }),
					}),
				);
			});

			it('should treat clean_progress: 0 as valid (not as absent)', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_progress]: 0,
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						cleaningProcess: expect.objectContaining({ clean_percent: 0 }),
					}),
				);
			});

			it('should set both clean_percent and segment_id when clean_progress and room_id_list present together', async () => {
				const msg = makeQ10Message(duid, {
					[Q10RequestCode.clean_progress]: 75,
					[Q10RequestCode.common_request]: {
						[Q10RequestCode.clean_expand]: {
							room_id_list: [9],
						},
					},
				});
				await listener.onMessage(msg);
				expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						duid,
						cleaningProcess: expect.objectContaining({ clean_percent: 75 }),
						cleaningInfo: expect.objectContaining({ segment_id: 9 }),
					}),
				);
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
