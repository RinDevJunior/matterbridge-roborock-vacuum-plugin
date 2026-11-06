import { describe, expect, it } from 'vitest';

import decodeComponent from '../../../roborockCommunication/helper/nameDecoder.js';

describe('nameDecoder (gap coverage)', () => {
	it('should return a malformed percent sequence unchanged when no token can be decoded', () => {
		// Arrange
		const malformed = '%E0%A4';

		// Act
		const result = decodeComponent(malformed);

		// Assert
		expect(result).toBe('%E0%A4');
	});

	it('should keep malformed text around valid text when decoding a mixed string', () => {
		// Arrange
		const mixed = 'Hi%E0%A4 there';

		// Act
		const result = decodeComponent(mixed);

		// Assert
		expect(result).toBe('Hi%E0%A4 there');
	});

	it('should decode valid runs and keep malformed runs intact in the same string', () => {
		// Arrange
		const input = 'Hello%20World%E0%A4';

		// Act
		const result = decodeComponent(input);

		// Assert
		expect(result).toBe('Hello World%E0%A4');
	});
});
