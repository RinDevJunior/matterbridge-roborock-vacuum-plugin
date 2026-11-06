import type protobuf from 'protobufjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { B01MapParser } from '../../../../roborockCommunication/map/b01/b01MapParser.js';
import { parseQ10MapPacket } from '../../../../roborockCommunication/map/b01/b01Q10MapParser.js';
import { parseQ10TracePacket } from '../../../../roborockCommunication/map/b01/b01Q10TraceParser.js';
import { asType } from '../../../helpers/testUtils.js';

vi.mock('../../../../roborockCommunication/map/b01/b01Q10MapParser.js', () => ({
	parseQ10MapPacket: vi.fn(),
}));

vi.mock('../../../../roborockCommunication/map/b01/b01Q10TraceParser.js', () => ({
	parseQ10TracePacket: vi.fn(),
}));

type DecodeResult = ReturnType<protobuf.Type['decode']>;

const Q10_MAP_PREFIX = Buffer.from([0x01, 0x01, 0x00]);
const TRACE_PREFIX = Buffer.from([0x02, 0x01, 0x00]);

describe('B01MapParser (gap coverage)', () => {
	let parser: B01MapParser;

	beforeEach(() => {
		vi.clearAllMocks();
		parser = new B01MapParser();
	});

	describe('parseRoomsFromEncryptedBinary error wrapping', () => {
		it('should wrap a non-Error thrown by the Q10 map parser with the Q10 map prefix message', () => {
			// Arrange
			vi.mocked(parseQ10MapPacket).mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act & Assert
			expect(() => parser.parseRoomsFromEncryptedBinary(Q10_MAP_PREFIX, 'ss', 'serial')).toThrow(
				/Q10 map binary parse failed .*boom/,
			);
		});

		it('should include the error message when the Q10 map parser throws an Error', () => {
			// Arrange
			vi.mocked(parseQ10MapPacket).mockImplementation(() => {
				throw new Error('kaboom');
			});

			// Act & Assert
			expect(() => parser.parseRoomsFromEncryptedBinary(Q10_MAP_PREFIX, 'ss', 'serial')).toThrow(/kaboom/);
		});

		it('should wrap a non-Error thrown by the Q10 trace parser with the trace packet prefix message', () => {
			// Arrange
			vi.mocked(parseQ10TracePacket).mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act & Assert
			expect(() => parser.parseRoomsFromEncryptedBinary(TRACE_PREFIX, 'ss', 'serial')).toThrow(
				/Q10 trace packet parse failed .*boom/,
			);
		});

		it('should include the error message when the Q10 trace parser throws an Error', () => {
			// Arrange
			vi.mocked(parseQ10TracePacket).mockImplementation(() => {
				throw new Error('kaboom');
			});

			// Act & Assert
			expect(() => parser.parseRoomsFromEncryptedBinary(TRACE_PREFIX, 'ss', 'serial')).toThrow(/kaboom/);
		});
	});

	describe('parseRooms', () => {
		it('should drop currentPose phi when it is not a number', () => {
			// Arrange
			const decodeSpy = vi.spyOn(parser['robotMapType'], 'decode');
			decodeSpy.mockReturnValue(asType<DecodeResult>({ currentPose: { x: 1, y: 2, phi: '3' } }));

			// Act
			const result = parser.parseRooms(Buffer.alloc(1));

			// Assert
			expect(result.currentPose).toEqual({ x: 1, y: 2, phi: undefined });
		});

		it('should keep currentPose phi when it is a number', () => {
			// Arrange
			const decodeSpy = vi.spyOn(parser['robotMapType'], 'decode');
			decodeSpy.mockReturnValue(asType<DecodeResult>({ currentPose: { x: 1, y: 2, phi: 3 } }));

			// Act
			const result = parser.parseRooms(Buffer.alloc(1));

			// Assert
			expect(result.currentPose).toEqual({ x: 1, y: 2, phi: 3 });
		});

		it('should use an empty room name and no label position when a room has neither name nor name post', () => {
			// Arrange
			const decodeSpy = vi.spyOn(parser['robotMapType'], 'decode');
			decodeSpy.mockReturnValue(asType<DecodeResult>({ roomDataInfo: [{ roomId: 1, roomTypeId: 0 }] }));

			// Act
			const result = parser.parseRooms(Buffer.alloc(1));

			// Assert
			expect(result.rooms).toHaveLength(1);
			expect(result.rooms[0].roomName).toBe('');
			expect(result.rooms[0].labelPos).toBeUndefined();
		});

		it('should map the room name post to a label position when present', () => {
			// Arrange
			const decodeSpy = vi.spyOn(parser['robotMapType'], 'decode');
			decodeSpy.mockReturnValue(
				asType<DecodeResult>({ roomDataInfo: [{ roomId: 2, roomName: 'Kitchen', roomNamePost: { x: 5, y: 6 } }] }),
			);

			// Act
			const result = parser.parseRooms(Buffer.alloc(1));

			// Assert
			expect(result.rooms[0].roomName).toBe('Kitchen');
			expect(result.rooms[0].labelPos).toEqual({ x: 5, y: 6 });
		});
	});
});
