import { describe, expect, it } from 'vitest';

import { HeaderMessage } from '../../../roborockCommunication/models/headerMessage.js';
import { Protocol } from '../../../roborockCommunication/models/protocol.js';
import { ResponseMessage } from '../../../roborockCommunication/models/responseMessage.js';
import { asType } from '../../helpers/testUtils.js';

describe('ResponseMessage.isForProtocol', () => {
	it('should return false when the message has no header', () => {
		// Arrange
		const message = new ResponseMessage('duid', asType<HeaderMessage>(undefined), undefined);
		// Act
		const result = message.isForProtocol(Protocol.rpc_response);
		// Assert
		expect(result).toBe(false);
	});

	it('should return true when the header protocol matches', () => {
		// Arrange
		const header = new HeaderMessage('1.0', 1, 2, 3, Protocol.rpc_response);
		const message = new ResponseMessage('duid', header, undefined);
		// Act
		const result = message.isForProtocol(Protocol.rpc_response);
		// Assert
		expect(result).toBe(true);
	});
});

describe('ResponseMessage.isForProtocols', () => {
	it('should return false when the message has no header', () => {
		// Arrange
		const message = new ResponseMessage('duid', asType<HeaderMessage>(undefined), undefined);
		// Act
		const result = message.isForProtocols([Protocol.rpc_response, Protocol.battery]);
		// Assert
		expect(result).toBe(false);
	});

	it('should return true when any listed protocol matches the header', () => {
		// Arrange
		const header = new HeaderMessage('1.0', 1, 2, 3, Protocol.rpc_response);
		const message = new ResponseMessage('duid', header, undefined);
		// Act
		const result = message.isForProtocols([Protocol.battery, Protocol.rpc_response]);
		// Assert
		expect(result).toBe(true);
	});

	it('should return false when no listed protocol matches the header', () => {
		// Arrange
		const header = new HeaderMessage('1.0', 1, 2, 3, Protocol.rpc_response);
		const message = new ResponseMessage('duid', header, undefined);
		// Act
		const result = message.isForProtocols([Protocol.battery]);
		// Assert
		expect(result).toBe(false);
	});
});
