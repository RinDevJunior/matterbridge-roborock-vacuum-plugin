import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Q10RequestCode } from '../../../../roborockCommunication/enums/Q10RequestCode.js';
import type { Dps } from '../../../../roborockCommunication/models/dps.js';
import {
	HeaderMessage,
	RequestMessage,
	ResponseBody,
	ResponseMessage,
} from '../../../../roborockCommunication/models/index.js';
import { Q10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.js';
import type { Client } from '../../../../roborockCommunication/routing/client.js';
import { asType, createMockLogger, makeMockClientRouter } from '../../../helpers/testUtils.js';

function makeMsgWithData(data: Dps | undefined): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	return new ResponseMessage('test-duid', header, new ResponseBody(asType<Dps>(data)));
}

describe('Q10MessageDispatcher (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let client: ReturnType<typeof makeMockClientRouter>;
	let dispatcher: Q10MessageDispatcher;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		client = makeMockClientRouter();
		dispatcher = new Q10MessageDispatcher(mockLogger, asType<Client>(client));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe('message id generation', () => {
		it('should increment the message id when two requests are issued in the same second', async () => {
			// Arrange
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);
			dispatcher = new Q10MessageDispatcher(mockLogger, asType<Client>(client));
			// Act
			await dispatcher.getDeviceStatus('duid-1');
			await dispatcher.getDeviceStatus('duid-1');
			// Assert
			const first = vi.mocked(client.send).mock.calls[0][1];
			const second = vi.mocked(client.send).mock.calls[1][1];
			expect(second.messageId).toBe(first.messageId + 1);
		});
	});

	describe('getHomeMap', () => {
		it('should return an empty object', async () => {
			// Arrange
			// Act
			const result = await dispatcher.getHomeMap('duid-1');
			// Assert
			expect(result).toEqual({});
		});
	});

	describe('switchMap and getRoomMapV2', () => {
		it('should send multi_map_switch with the map id when switchMap is called', async () => {
			// Arrange
			vi.mocked(client.send).mockResolvedValueOnce(undefined);
			// Act
			await dispatcher.switchMap('duid-1', 4);
			// Assert
			const sent = vi.mocked(client.send).mock.calls[0][1];
			expect(sent).toBeInstanceOf(RequestMessage);
			expect(sent.dps).toEqual({ [Q10RequestCode.multi_map_switch]: 4 });
		});

		it('should send a single get_prop request when getRoomMapV2 is called', async () => {
			// Arrange
			vi.mocked(client.send).mockResolvedValueOnce(undefined);
			// Act
			await dispatcher.getRoomMapV2('duid-1', 0);
			// Assert
			expect(vi.mocked(client.send)).toHaveBeenCalledTimes(1);
			expect(vi.mocked(client.send).mock.calls[0][0]).toBe('duid-1');
		});
	});

	describe('skipRoomCleaning', () => {
		it('should throw a not-supported error when called', () => {
			// Arrange
			const duid = 'duid-1';
			// Act & Assert
			expect(() => dispatcher.skipRoomCleaning(duid)).toThrow(
				'skipRoomCleaning is not supported on Q10MessageDispatcher',
			);
		});
	});

	describe('getCustomMessage parser', () => {
		async function captureParser() {
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			await dispatcher.getCustomMessage('duid-1', new RequestMessage({ method: 'get_prop' }));
			return vi.mocked(client.query).mock.calls[0][2];
		}

		it('should return undefined when the message has no body', async () => {
			// Arrange
			const parser = await captureParser();
			const header = new HeaderMessage('1.0', 1, 0, 101, 102);
			// Act
			const result = parser(new ResponseMessage('test-duid', header, undefined));
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when the body data is undefined', async () => {
			// Arrange
			const parser = await captureParser();
			// Act
			const result = parser(makeMsgWithData(undefined));
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when the body data is empty', async () => {
			// Arrange
			const parser = await captureParser();
			// Act
			const result = parser(makeMsgWithData({}));
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return the first value when the body data has entries', async () => {
			// Arrange
			const parser = await captureParser();
			// Act
			const result = parser(makeMsgWithData(asType<Dps>({ a: 5 })));
			// Assert
			expect(result).toBe(5);
		});
	});
});
