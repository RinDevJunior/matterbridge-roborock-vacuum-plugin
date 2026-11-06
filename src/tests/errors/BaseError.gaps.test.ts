import { describe, expect, it } from 'vitest';

import { BaseError } from '../../errors/BaseError.js';

class TestError extends BaseError {}

describe('BaseError (gaps)', () => {
	describe('toJSON', () => {
		it('should serialize name, message, code, statusCode, metadata and stack when all fields are set', () => {
			// Arrange
			const metadata = { duid: 'duid-1', attempt: 2 };
			const error = new TestError('boom message', 'TEST_CODE', 418, metadata);
			// Act
			const json = error.toJSON();
			// Assert
			expect(json).toEqual({
				name: 'TestError',
				message: 'boom message',
				code: 'TEST_CODE',
				statusCode: 418,
				metadata,
				stack: error.stack,
			});
		});

		it('should serialize undefined statusCode and metadata when they are omitted', () => {
			// Arrange
			const error = new TestError('no extras', 'NO_EXTRAS');
			// Act
			const json = error.toJSON();
			// Assert
			expect(json).toMatchObject({ name: 'TestError', message: 'no extras', code: 'NO_EXTRAS' });
			expect(json.statusCode).toBeUndefined();
			expect(json.metadata).toBeUndefined();
		});
	});
});
