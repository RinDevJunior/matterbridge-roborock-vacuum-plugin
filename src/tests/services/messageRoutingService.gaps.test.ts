import type { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapInfo } from '../../core/application/models/index.js';
import type { RawRoomMappingData, RequestMessage } from '../../roborockCommunication/models/index.js';
import type { AbstractMessageDispatcher } from '../../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

const DUID = 'duid-1';

function createMockDispatcher(): AbstractMessageDispatcher {
	return asPartial<AbstractMessageDispatcher>({
		getMapInfo: vi.fn(),
		getRoomMap: vi.fn(),
		skipRoomCleaning: vi.fn().mockResolvedValue(undefined),
		stopCleaning: vi.fn().mockResolvedValue(undefined),
		getCustomMessage: vi.fn(),
		sendCustomMessage: vi.fn().mockResolvedValue(undefined),
	});
}

describe('MessageRoutingService (gaps)', () => {
	let logger: AnsiLogger;
	let dispatcher: AbstractMessageDispatcher;
	let service: MessageRoutingService;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		dispatcher = createMockDispatcher();
		service = new MessageRoutingService(logger);
		service.registerMessageDispatcher(DUID, dispatcher);
	});

	it('should return the dispatcher map info when getMapInfo is called', async () => {
		// Arrange
		const mapInfo = asPartial<MapInfo>({});
		vi.mocked(dispatcher.getMapInfo).mockResolvedValue(mapInfo);
		// Act
		const result = await service.getMapInfo(DUID);
		// Assert
		expect(result).toBe(mapInfo);
		expect(dispatcher.getMapInfo).toHaveBeenCalledWith(DUID);
	});

	it('should forward the active map id and return the dispatcher room map when getRoomMap is called', async () => {
		// Arrange
		const roomMap = asType<RawRoomMappingData>([]);
		vi.mocked(dispatcher.getRoomMap).mockResolvedValue(roomMap);
		// Act
		const result = await service.getRoomMap(DUID, 2);
		// Assert
		expect(result).toBe(roomMap);
		expect(dispatcher.getRoomMap).toHaveBeenCalledWith(DUID, 2);
	});

	it('should delegate skipRoomCleaning to the dispatcher and log the call when skipRoomCleaning is invoked', async () => {
		// Arrange
		// Act
		await service.skipRoomCleaning(DUID);
		// Assert
		expect(logger.debug).toHaveBeenCalledWith('MessageRoutingService - skipRoomCleaning');
		expect(dispatcher.skipRoomCleaning).toHaveBeenCalledWith(DUID);
	});

	it('should delegate stopClean to the dispatcher and log the call when stopClean is invoked', async () => {
		// Arrange
		// Act
		await service.stopClean(DUID);
		// Assert
		expect(logger.debug).toHaveBeenCalledWith('MessageRoutingService - stopClean');
		expect(dispatcher.stopCleaning).toHaveBeenCalledWith(DUID);
	});

	it('should return the dispatcher custom response and log the request when customGet is invoked', async () => {
		// Arrange
		const request = asPartial<RequestMessage>({ method: 'get_status', params: [], secure: false });
		vi.mocked(dispatcher.getCustomMessage).mockResolvedValue({ ok: true });
		// Act
		const result = await service.customGet(DUID, request);
		// Assert
		expect(result).toEqual({ ok: true });
		expect(logger.debug).toHaveBeenCalledWith('MessageRoutingService - customSend-message', 'get_status', [], false);
		expect(dispatcher.getCustomMessage).toHaveBeenCalledWith(DUID, request);
	});

	it('should forward the custom request to the dispatcher when customSend is invoked', async () => {
		// Arrange
		const request = asPartial<RequestMessage>({ method: 'set_clean', params: [1] });
		// Act
		await service.customSend(DUID, request);
		// Assert
		expect(dispatcher.sendCustomMessage).toHaveBeenCalledWith(DUID, request);
	});
});
