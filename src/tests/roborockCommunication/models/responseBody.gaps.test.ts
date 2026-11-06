import { describe, expect, it } from 'vitest';

import type { Dps } from '../../../roborockCommunication/models/dps.js';
import { Protocol } from '../../../roborockCommunication/models/protocol.js';
import { ResponseBody } from '../../../roborockCommunication/models/responseBody.js';
import { asType } from '../../helpers/testUtils.js';

describe('ResponseBody.get', () => {
	it('should return undefined when the underlying data is undefined', () => {
		// Arrange
		const body = new ResponseBody(asType<Dps>(undefined));
		// Act
		const result = body.get(1);
		// Assert
		expect(result).toBeUndefined();
	});

	it('should return the stored value when read by numeric protocol index', () => {
		// Arrange
		const body = new ResponseBody(asType<Dps>({ '102': 'value' }));
		// Act
		const result = body.get(Protocol.rpc_response);
		// Assert
		expect(result).toBe('value');
	});

	it('should return the stored value when read by string index', () => {
		// Arrange
		const body = new ResponseBody(asType<Dps>({ '102': 'value' }));
		// Act
		const result = body.get('102');
		// Assert
		expect(result).toBe('value');
	});

	it('should return undefined when the requested key is absent', () => {
		// Arrange
		const body = new ResponseBody(asType<Dps>({ '102': 'value' }));
		// Act
		const result = body.get(Protocol.battery);
		// Assert
		expect(result).toBeUndefined();
	});
});
