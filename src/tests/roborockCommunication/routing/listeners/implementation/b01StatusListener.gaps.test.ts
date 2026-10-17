import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Q7RequestCode, Q7RequestMethod } from '../../../../../roborockCommunication/enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../../../roborockCommunication/enums/Q10RequestCode.js';
import type { Dps } from '../../../../../roborockCommunication/models/dps.js';
import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import type { AbstractMessageHandler } from '../../../../../roborockCommunication/routing/handlers/abstractMessageHandler.js';
import { B01StatusListener } from '../../../../../roborockCommunication/routing/listeners/implementation/b01StatusListener.js';
import { asPartial, asType, createMockLogger } from '../../../../helpers/testUtils.js';

const DUID = 'duid-1';

function makeMessage(entries: Record<string | number, unknown>, duid = DUID): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	return new ResponseMessage(duid, header, new ResponseBody(asType<Dps>(entries)));
}

function createMockHandler(): AbstractMessageHandler {
	return asPartial<AbstractMessageHandler>({
		onError: vi.fn(),
		onStatusChanged: vi.fn(),
		onBatteryUpdate: vi.fn(),
		onCleanModeUpdate: vi.fn(),
		onServiceAreaUpdate: vi.fn(),
	});
}

describe('B01StatusListener (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let handler: AbstractMessageHandler;
	let listener: B01StatusListener;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		handler = createMockHandler();
		listener = new B01StatusListener(DUID, mockLogger);
		listener.registerHandler(handler);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('onMessage guards', () => {
		it('should not call any handler when the message has no body', async () => {
			// Arrange
			const header = new HeaderMessage('1.0', 1, 0, 101, 102);
			const msg = new ResponseMessage(DUID, header, undefined);
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onStatusChanged).not.toHaveBeenCalled();
			expect(handler.onServiceAreaUpdate).not.toHaveBeenCalled();
			expect(handler.onCleanModeUpdate).not.toHaveBeenCalled();
		});
	});

	describe('Q10 service area updates', () => {
		it('should report clean_percent only when only clean_progress is present', async () => {
			// Arrange
			const msg = makeMessage({ [Q10RequestCode.clean_progress]: 40 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					cleaningProcess: expect.objectContaining({ clean_area: 0, clean_time: 0, clean_percent: 40 }),
				}),
			);
		});

		it('should leave clean_percent undefined when only clean_area is present', async () => {
			// Arrange
			const msg = makeMessage({ [Q10RequestCode.clean_area]: 12 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					cleaningProcess: expect.objectContaining({ clean_area: 12, clean_percent: undefined }),
				}),
			);
		});

		it('should omit cleaningInfo when no room id has been seen yet', async () => {
			// Arrange
			const msg = makeMessage({ [Q10RequestCode.clean_area]: 12 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(expect.objectContaining({ cleaningInfo: undefined }));
		});

		it('should reuse the last seen room id in cleaningInfo on a later message without a room id', async () => {
			// Arrange
			const roomMsg = makeMessage({
				[Q10RequestCode.common_request]: { [String(Q10RequestCode.clean_expand)]: { room_id_list: [5] } },
			});
			const areaMsg = makeMessage({ [Q10RequestCode.clean_area]: 3 });
			// Act
			await listener.onMessage(roomMsg);
			await listener.onMessage(areaMsg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenLastCalledWith(
				expect.objectContaining({
					cleaningInfo: expect.objectContaining({ segment_id: 5 }),
				}),
			);
		});
	});

	describe('Q7 query_response', () => {
		it('should handle an object-shaped query_response with prop.post method', async () => {
			// Arrange
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: 'prop.post', data: { status: 5 } },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onStatusChanged).toHaveBeenCalledTimes(1);
		});

		it('should not emit any update when the query_response has no data field', async () => {
			// Arrange
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: Q7RequestMethod.get_prop },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onStatusChanged).not.toHaveBeenCalled();
			expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
			expect(handler.onServiceAreaUpdate).not.toHaveBeenCalled();
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it('should use mop route 0 when clean_path_preference is absent', async () => {
			// Arrange
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: Q7RequestMethod.get_prop, data: { wind: 2 } },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ mopRoute: 0, suctionPower: 102 }),
			);
		});

		it('should convert cleaning_area to centi-units and leave clean_time 0 when only cleaning_area is set', async () => {
			// Arrange
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: Q7RequestMethod.get_prop, data: { cleaning_area: 2 } },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					cleaningProcess: expect.objectContaining({ clean_area: 200, clean_time: 0 }),
				}),
			);
		});

		it('should convert cleaning_time to seconds and leave clean_area 0 when only cleaning_time is set', async () => {
			// Arrange
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: Q7RequestMethod.get_prop, data: { cleaning_time: 3 } },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					cleaningProcess: expect.objectContaining({ clean_area: 0, clean_time: 180 }),
				}),
			);
		});

		it('should log a warning when the query_response is malformed JSON', async () => {
			// Arrange
			const msg = makeMessage({ [Q7RequestCode.query_response]: '{bad' });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to parse Q7 query_response'));
		});
	});
});
