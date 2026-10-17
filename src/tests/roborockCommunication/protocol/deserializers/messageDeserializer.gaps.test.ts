import CRC32 from 'crc-32';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtocolVersion } from '../../../../roborockCommunication/enums/index.js';
import { MessageContext, Protocol } from '../../../../roborockCommunication/models/index.js';
import { MessageDeserializer } from '../../../../roborockCommunication/protocol/deserializers/messageDeserializer.js';
import { MessageSerializerFactory } from '../../../../roborockCommunication/protocol/serializers/messageSerializerFactory.js';
import { asType, createMockLogger } from '../../../helpers/testUtils.js';

const DUID = 'duid-1';
const HEADER_LENGTH = 17;

/** Builds a wire frame: 17-byte header, u16 payload length, payload, u32 CRC32 (big endian). */
function buildFrame(version: string, protocol: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(HEADER_LENGTH);
	header.write(version, 0, 3, 'ascii');
	header.writeUInt32BE(1, 3); // seq
	header.writeUInt32BE(2, 7); // nonce
	header.writeUInt32BE(3, 11); // timestamp
	header.writeUInt16BE(protocol, 15);

	const lengthBuffer = Buffer.alloc(2);
	lengthBuffer.writeUInt16BE(payload.length, 0);

	const body = Buffer.concat([header, lengthBuffer, payload]);
	const crcBuffer = Buffer.alloc(4);
	crcBuffer.writeUInt32BE(CRC32.buf(body) >>> 0, 0);
	return Buffer.concat([body, crcBuffer]);
}

function createMockContext(): MessageContext {
	return asType<MessageContext>({
		nonce: 1,
		getLocalKey: vi.fn(() => 'local-key'),
		getDeviceNonce: vi.fn(() => 2),
	});
}

describe('MessageDeserializer (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let mockContext: MessageContext;
	let deserializer: MessageDeserializer;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		mockContext = createMockContext();
		deserializer = new MessageDeserializer(mockContext, mockLogger);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('deserialize unknown protocol version', () => {
		it('should throw an unknown protocol error when the header version is not supported', () => {
			// Arrange
			const frame = buildFrame('XYZ', Protocol.rpc_response, Buffer.alloc(0));

			// Act & Assert
			expect(() => deserializer.deserialize(DUID, frame, 'Test')).toThrow('unknown protocol: XYZ');
		});
	});

	describe('deserialize device_status_ota payload', () => {
		beforeEach(() => {
			vi.spyOn(MessageSerializerFactory.prototype, 'getMessageSerializer').mockReturnValue(
				asType<ReturnType<MessageSerializerFactory['getMessageSerializer']>>({
					decode: (payload: Buffer) => payload,
				}),
			);
		});

		it('should return a response without body and log a warning when the OTA payload is not valid JSON', () => {
			// Arrange
			const frame = buildFrame(ProtocolVersion.A01, Protocol.device_status_ota, Buffer.from('not json'));

			// Act
			const response = deserializer.deserialize(DUID, frame, 'Test');

			// Assert
			expect(response.get(Protocol.device_status_ota)).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('device_status_ota parse error'));
		});

		it('should include a non-Error thrown during OTA parsing in the warning', () => {
			// Arrange
			vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
				throw asType<Error>('boom');
			});
			const frame = buildFrame(ProtocolVersion.A01, Protocol.device_status_ota, Buffer.from('{"a":1}'));

			// Act
			const response = deserializer.deserialize(DUID, frame, 'Test');

			// Assert
			expect(response.get(Protocol.device_status_ota)).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
		});
	});
});
