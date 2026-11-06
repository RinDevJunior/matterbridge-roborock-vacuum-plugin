import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Dps } from '../../../../../roborockCommunication/models/dps.js';
import {
	HeaderMessage,
	Protocol,
	ResponseBody,
	ResponseMessage,
} from '../../../../../roborockCommunication/models/index.js';
import type { AbstractMessageHandler } from '../../../../../roborockCommunication/routing/handlers/abstractMessageHandler.js';
import { V1StatusListener } from '../../../../../roborockCommunication/routing/listeners/implementation/v1StatusListener.js';
import { asPartial, asType, createMockLogger } from '../../../../helpers/testUtils.js';

const DUID = 'duid-1';

// Build a rpc_response message whose result[0] is the raw device status object
function makeStatusMessage(rawStatus: Record<string, unknown>, duid = DUID): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, Protocol.rpc_response);
	const body = new ResponseBody(asType<Dps>({ [Protocol.rpc_response]: { id: 1, result: [rawStatus] } }));
	return new ResponseMessage(duid, header, body);
}

function createMockHandler(): AbstractMessageHandler {
	return asPartial<AbstractMessageHandler>({
		onError: vi.fn(),
		onActiveMapChanged: vi.fn(),
		onBatteryUpdate: vi.fn(),
		onStatusChanged: vi.fn(),
		onCleanModeUpdate: vi.fn(),
		onServiceAreaUpdate: vi.fn(),
	});
}

describe('V1StatusListener (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let handler: AbstractMessageHandler;
	let listener: V1StatusListener;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		handler = createMockHandler();
		listener = new V1StatusListener(DUID, mockLogger);
		listener.registerHandler(handler);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('clean mode fallbacks when cleaning_info is absent', () => {
		it('should use top-level fan_power, water_box_mode and mop_mode when cleaning_info is missing', async () => {
			// Arrange
			const msg = makeStatusMessage({ state: 5, fan_power: 101, water_box_mode: 201, mop_mode: 2 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ suctionPower: 101, waterFlow: 201, mopRoute: 2 }),
			);
		});
	});

	describe('boolean status flags', () => {
		it.each([
			['in_cleaning', 'inCleaning'],
			['in_returning', 'inReturning'],
			['in_fresh_state', 'inFreshState'],
			['is_locating', 'isLocating'],
			['is_exploring', 'isExploring'],
			['in_warmup', 'inWarmup'],
		])('should map %s = 1 to a true %s flag on the status change message', async (rawKey, messageKey) => {
			// Arrange
			const msg = makeStatusMessage({ state: 5, [rawKey]: 1 });
			// Act
			await listener.onMessage(msg);
			// Assert
			const statusMsg = vi.mocked(handler.onStatusChanged).mock.calls[0][0];
			expect(statusMsg[messageKey as keyof typeof statusMsg]).toBe(true);
		});

		it('should leave all boolean flags undefined when none are present in the status', async () => {
			// Arrange
			const msg = makeStatusMessage({ state: 5 });
			// Act
			await listener.onMessage(msg);
			// Assert
			const statusMsg = vi.mocked(handler.onStatusChanged).mock.calls[0][0];
			expect(statusMsg.inCleaning).toBeUndefined();
			expect(statusMsg.inWarmup).toBeUndefined();
			expect(statusMsg.isExploring).toBeUndefined();
		});
	});

	describe('map_status handling', () => {
		it('should not report an active map when map_status is a string', async () => {
			// Arrange
			const msg = makeStatusMessage({ state: 5, map_status: 'active' });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onActiveMapChanged).not.toHaveBeenCalled();
		});

		it('should report map flag 1 when map_status is 4 (4 >> 2)', async () => {
			// Arrange
			const msg = makeStatusMessage({ state: 5, map_status: 4 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onActiveMapChanged).toHaveBeenCalledWith(1);
		});

		it('should not report an active map when map_status is 252 (252 >> 2 = 63 sentinel)', async () => {
			// Arrange
			const msg = makeStatusMessage({ state: 5, map_status: 252 });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(handler.onActiveMapChanged).not.toHaveBeenCalled();
		});
	});
});
