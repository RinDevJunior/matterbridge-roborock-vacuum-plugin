import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtocolVersion } from '../../../../../roborockCommunication/enums/protocolVersion.js';
import { Q7RequestCode, Q7RequestMethod } from '../../../../../roborockCommunication/enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../../../roborockCommunication/enums/Q10RequestCode.js';
import { B01MapParser } from '../../../../../roborockCommunication/map/b01/b01MapParser.js';
import { LegacyMapParser } from '../../../../../roborockCommunication/map/v1/mapParser.js';
import { decryptAndUnzipV1Map } from '../../../../../roborockCommunication/map/v1/v1MapDecryptor.js';
import type { Dps } from '../../../../../roborockCommunication/models/dps.js';
import type { RoomDto } from '../../../../../roborockCommunication/models/home/RoomDto.js';
import {
	HeaderMessage,
	Protocol,
	ResponseBody,
	ResponseMessage,
} from '../../../../../roborockCommunication/models/index.js';
import { MapInfoListener } from '../../../../../roborockCommunication/routing/listeners/implementation/mapInfoListener.js';
import { AreaManagementService } from '../../../../../services/areaManagementService.js';
import { asPartial, asType, createMockLogger } from '../../../../helpers/testUtils.js';

vi.mock('../../../../../roborockCommunication/map/v1/v1MapDecryptor.js', () => ({
	decryptAndUnzipV1Map: vi.fn(),
}));

const DUID = 'duid-1';

function makeMessage(entries: Record<string | number, unknown>, duid = DUID): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	return new ResponseMessage(duid, header, new ResponseBody(asType<Dps>(entries)));
}

function makeDps(result: unknown): { id: number; result: unknown } {
	return { id: 1, result };
}

describe('MapInfoListener (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let areaService: AreaManagementService;
	let rooms: RoomDto[];

	interface ListenerOptions {
		deviceModel?: string;
		deviceSerial?: string;
		onActiveMapChanged?: (mapId: number) => void;
		deviceProtocol?: string;
		allowV1AreaUpdate?: boolean;
		enableMultipleMap?: boolean;
		sessionNonce?: () => Buffer | undefined;
		onV1RoomResolved?: (segmentId: number) => void;
	}

	function createListener(options: ListenerOptions = {}): MapInfoListener {
		return new MapInfoListener(
			DUID,
			rooms,
			areaService,
			mockLogger,
			options.deviceModel,
			options.deviceSerial,
			options.onActiveMapChanged,
			options.deviceProtocol,
			options.allowV1AreaUpdate ?? true,
			options.enableMultipleMap ?? true,
			options.sessionNonce,
			options.onV1RoomResolved,
		);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		areaService = asPartial<AreaManagementService>({
			applySupportedAreasResult: vi.fn(),
			setSupportedMaps: vi.fn(),
		});
		rooms = asType<RoomDto[]>([{ id: 1, name: 'Kitchen' }]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	describe('allowV1AreaUpdate disabled', () => {
		it('should not apply areas when a V1 map-info push arrives and allowV1AreaUpdate is false', async () => {
			// Arrange
			const listener = createListener({ allowV1AreaUpdate: false });
			const msg = makeMessage({
				[Protocol.rpc_response]: makeDps({ max_multi_map: 1, max_bak_map: 0, multi_map_count: 1, map_info: [] }),
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.applySupportedAreasResult).not.toHaveBeenCalled();
		});

		it('should not apply areas when a V1 room-map push arrives and allowV1AreaUpdate is false', async () => {
			// Arrange
			const listener = createListener({ allowV1AreaUpdate: false });
			const msg = makeMessage({ [Protocol.rpc_response]: makeDps([[1, 'Kitchen']]) });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.applySupportedAreasResult).not.toHaveBeenCalled();
		});
	});

	describe('B01 multimap push', () => {
		it('should fall back to mapFlag 0 and default names when entries lack mapFlag, id and name', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Q10RequestCode.multimap]: { data: [{ id: 7 }, {}] } });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).toHaveBeenCalledWith(DUID, [
				{ mapId: 7, name: 'Default Map 1' },
				{ mapId: 0, name: 'Default Map 2' },
			]);
		});

		it('should not set supported maps when multimap data is not an array', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Q10RequestCode.multimap]: { data: 'nope' } });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).not.toHaveBeenCalled();
		});
	});

	describe('B01-Q7 query_response map list', () => {
		it('should parse an object-shaped query_response and set supported maps', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({
				[Q7RequestCode.query_response]: {
					method: Q7RequestMethod.get_map_list,
					data: { map_list: [{ id: 3, name: 'Main' }] },
				},
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).toHaveBeenCalledWith(DUID, [{ mapId: 3, name: 'Main' }]);
		});

		it('should parse a JSON-string query_response and set supported maps', async () => {
			// Arrange
			const listener = createListener();
			const payload = JSON.stringify({
				method: Q7RequestMethod.get_map_list,
				data: { map_list: [{ id: 4, name: 'B' }] },
			});
			const msg = makeMessage({ [Q7RequestCode.query_response]: payload });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).toHaveBeenCalledWith(DUID, [{ mapId: 4, name: 'B' }]);
		});

		it('should fall back to default map name when a map_list entry has no name', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({
				[Q7RequestCode.query_response]: {
					method: Q7RequestMethod.get_map_list,
					data: { map_list: [{ id: 2 }] },
				},
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).toHaveBeenCalledWith(DUID, [{ mapId: 2, name: 'Default Map 1' }]);
		});

		it('should report the active map when an entry is flagged cur', async () => {
			// Arrange
			const onActiveMapChanged = vi.fn();
			const listener = createListener({ onActiveMapChanged });
			const msg = makeMessage({
				[Q7RequestCode.query_response]: {
					method: Q7RequestMethod.get_map_list,
					data: { map_list: [{ id: 3, name: 'Main', cur: true }] },
				},
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(onActiveMapChanged).toHaveBeenCalledWith(3);
		});

		it('should not report an active map when no entry is flagged cur', async () => {
			// Arrange
			const onActiveMapChanged = vi.fn();
			const listener = createListener({ onActiveMapChanged });
			const msg = makeMessage({
				[Q7RequestCode.query_response]: {
					method: Q7RequestMethod.get_map_list,
					data: { map_list: [{ id: 3, name: 'Main' }] },
				},
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(onActiveMapChanged).not.toHaveBeenCalled();
		});

		it.each([
			['data is an empty object', {}],
			['map_list is not an array', { map_list: 'x' }],
		])('should not set supported maps when %s', async (_label, data) => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({
				[Q7RequestCode.query_response]: { method: Q7RequestMethod.get_map_list, data },
			});
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.setSupportedMaps).not.toHaveBeenCalled();
		});

		it('should log a warning when query_response is malformed JSON', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Q7RequestCode.query_response]: '{not json' });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to parse B01-Q7 query_response'));
		});
	});

	describe('B01 map binary', () => {
		const roomsParsed = {
			rooms: [{ roomId: 1, roomName: 'Kitchen', roomTypeId: 0 }],
			mapId: 5,
		};

		function binaryMessage(): ResponseMessage {
			return makeMessage({ [Protocol.map_response]: Buffer.from([1, 2, 3]) });
		}

		function mockParser() {
			return vi
				.spyOn(B01MapParser.prototype, 'parseRoomsFromEncryptedBinary')
				.mockReturnValue(asType<ReturnType<B01MapParser['parseRoomsFromEncryptedBinary']>>(roomsParsed));
		}

		it('should apply areas and report the parsed map id when the binary has rooms', async () => {
			// Arrange
			mockParser();
			const onActiveMapChanged = vi.fn();
			const listener = createListener({ deviceModel: 'roborock.vacuum.a01', deviceSerial: 'SN1', onActiveMapChanged });
			// Act
			await listener.onMessage(binaryMessage());
			// Assert
			expect(areaService.applySupportedAreasResult).toHaveBeenCalledWith(DUID, expect.anything(), 5);
			expect(onActiveMapChanged).toHaveBeenCalledWith(5);
		});

		it('should pass undefined as merge id when enableMultipleMap is false', async () => {
			// Arrange
			mockParser();
			const listener = createListener({
				deviceModel: 'roborock.vacuum.a01',
				deviceSerial: 'SN1',
				enableMultipleMap: false,
			});
			// Act
			await listener.onMessage(binaryMessage());
			// Assert
			expect(areaService.applySupportedAreasResult).toHaveBeenCalledWith(DUID, expect.anything(), undefined);
		});

		it('should use map id 0 and skip onActiveMapChanged when the parsed info has no map id', async () => {
			// Arrange
			vi.spyOn(B01MapParser.prototype, 'parseRoomsFromEncryptedBinary').mockReturnValue(
				asType<ReturnType<B01MapParser['parseRoomsFromEncryptedBinary']>>({
					rooms: [{ roomId: 1, roomName: 'Kitchen', roomTypeId: 0 }],
				}),
			);
			const onActiveMapChanged = vi.fn();
			const listener = createListener({ deviceModel: 'roborock.vacuum.a01', deviceSerial: 'SN1', onActiveMapChanged });
			// Act
			await listener.onMessage(binaryMessage());
			// Assert
			expect(areaService.applySupportedAreasResult).toHaveBeenCalledWith(DUID, expect.anything(), 0);
			expect(onActiveMapChanged).not.toHaveBeenCalled();
		});

		it('should skip the binary and log a warning when model or serial is missing', async () => {
			// Arrange
			const parseSpy = mockParser();
			const listener = createListener({ deviceModel: 'roborock.vacuum.a01' });
			// Act
			await listener.onMessage(binaryMessage());
			// Assert
			expect(parseSpy).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('missing model/serial'));
		});

		it('should log a warning when the B01 parser throws', async () => {
			// Arrange
			vi.spyOn(B01MapParser.prototype, 'parseRoomsFromEncryptedBinary').mockImplementation(() => {
				throw new Error('bad binary');
			});
			const listener = createListener({ deviceModel: 'roborock.vacuum.a01', deviceSerial: 'SN1' });
			// Act
			await listener.onMessage(binaryMessage());
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('bad binary'));
		});
	});

	describe('V1 map binary', () => {
		function v1Message(): ResponseMessage {
			return makeMessage({ [Protocol.map_response]: Buffer.from([9, 9, 9]) });
		}

		it('should report the resolved segment id when the V1 binary resolves a room', async () => {
			// Arrange
			vi.mocked(decryptAndUnzipV1Map).mockReturnValueOnce(Buffer.from('decrypted'));
			vi.spyOn(LegacyMapParser.prototype, 'parse').mockReturnValueOnce(
				asType<ReturnType<LegacyMapParser['parse']>>({}),
			);
			vi.spyOn(LegacyMapParser.prototype, 'resolveCurrentRoom').mockReturnValueOnce(
				asType<ReturnType<LegacyMapParser['resolveCurrentRoom']>>({ segmentId: 9 }),
			);
			const onV1RoomResolved = vi.fn();
			const listener = createListener({
				deviceProtocol: ProtocolVersion.V1,
				sessionNonce: () => Buffer.from('nonce'),
				onV1RoomResolved,
			});
			// Act
			await listener.onMessage(v1Message());
			// Assert
			expect(onV1RoomResolved).toHaveBeenCalledWith(9);
		});

		it('should not report a room when the V1 parser resolves nothing', async () => {
			// Arrange
			vi.mocked(decryptAndUnzipV1Map).mockReturnValueOnce(Buffer.from('decrypted'));
			vi.spyOn(LegacyMapParser.prototype, 'parse').mockReturnValueOnce(
				asType<ReturnType<LegacyMapParser['parse']>>({}),
			);
			vi.spyOn(LegacyMapParser.prototype, 'resolveCurrentRoom').mockReturnValueOnce(undefined);
			const onV1RoomResolved = vi.fn();
			const listener = createListener({
				deviceProtocol: ProtocolVersion.V1,
				sessionNonce: () => Buffer.from('nonce'),
				onV1RoomResolved,
			});
			// Act
			await listener.onMessage(v1Message());
			// Assert
			expect(onV1RoomResolved).not.toHaveBeenCalled();
		});

		it('should log the error message and cause when decryption throws an Error with a cause', async () => {
			// Arrange
			vi.mocked(decryptAndUnzipV1Map).mockImplementationOnce(() => {
				throw new Error('outer', { cause: new Error('inner') });
			});
			const listener = createListener({
				deviceProtocol: ProtocolVersion.V1,
				sessionNonce: () => Buffer.from('nonce'),
			});
			// Act
			await listener.onMessage(v1Message());
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('outer | cause: inner'));
		});

		it('should log the thrown string without a cause suffix when a non-Error is thrown', async () => {
			// Arrange
			vi.mocked(decryptAndUnzipV1Map).mockImplementationOnce(() => {
				// Non-Error value on purpose: the listener must stringify it. Cast keeps lint happy.
				throw asType<Error>('boom');
			});
			const listener = createListener({
				deviceProtocol: ProtocolVersion.V1,
				sessionNonce: () => Buffer.from('nonce'),
			});
			// Act
			await listener.onMessage(v1Message());
			// Assert
			const warnText = vi.mocked(mockLogger.warn).mock.calls[0][0];
			expect(warnText).toContain('boom');
			expect(warnText).not.toContain('| cause');
		});

		it('should skip parsing when no session nonce is available', async () => {
			// Arrange
			const listener = createListener({
				deviceProtocol: ProtocolVersion.V1,
				sessionNonce: () => undefined,
			});
			// Act
			await listener.onMessage(v1Message());
			// Assert
			expect(decryptAndUnzipV1Map).not.toHaveBeenCalled();
		});
	});

	describe('malformed V1 payloads', () => {
		it('should not apply areas when the V1 map-info result is a plain string', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Protocol.rpc_response]: makeDps('text') });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.applySupportedAreasResult).not.toHaveBeenCalled();
		});

		it('should not apply areas when the V1 result is null', async () => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Protocol.rpc_response]: makeDps(null) });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.applySupportedAreasResult).not.toHaveBeenCalled();
		});

		it.each([
			['an empty array', []],
			['a row with a non-number id', [[1]]],
			['a row with a non-string name', [['x', 'y']]],
		])('should not apply areas when the V1 room-map result is %s', async (_label, result) => {
			// Arrange
			const listener = createListener();
			const msg = makeMessage({ [Protocol.rpc_response]: makeDps(result) });
			// Act
			await listener.onMessage(msg);
			// Assert
			expect(areaService.applySupportedAreasResult).not.toHaveBeenCalled();
		});
	});
});
