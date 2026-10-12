import { describe, expect, it } from 'vitest';

import { decompressLz4Block } from '../../../../roborockCommunication/map/b01/lz4BlockDecompressor.js';

const TRUNCATED_MESSAGE = 'LZ4 block decompress failed: unexpected end of input';

describe('decompressLz4Block (gap coverage)', () => {
	describe('truncated input', () => {
		it.each([
			{ name: 'literal length extension byte runs past end of input', input: [0xf0, 0xff] },
			{ name: 'literal run longer than remaining input', input: [0x50, 0x01, 0x02] },
			{ name: 'match offset missing after literals', input: [0x10, 0x41, 0x01] },
			{ name: 'match length extension byte missing at end of input', input: [0x1f, 0x41, 0x01, 0x00, 0xff] },
		])('should throw unexpected end of input when $name', ({ input }) => {
			// Arrange
			const data = Buffer.from(input);

			// Act & Assert
			expect(() => decompressLz4Block(data)).toThrow(TRUNCATED_MESSAGE);
		});
	});

	describe('valid input', () => {
		it('should return an empty buffer when input is empty', () => {
			// Arrange
			const data = Buffer.alloc(0);

			// Act
			const result = decompressLz4Block(data);

			// Assert
			expect(result.length).toBe(0);
		});

		it('should return literals only when the block ends after the literal run', () => {
			// Arrange
			const data = Buffer.from([0x30, 0x61, 0x62, 0x63]);

			// Act
			const result = decompressLz4Block(data);

			// Assert
			expect(result.toString('utf8')).toBe('abc');
		});

		it('should copy a match from previously decoded output', () => {
			// Arrange: 4 literals "abcd", then match offset 4 and length 4
			const data = Buffer.from([0x40, 0x61, 0x62, 0x63, 0x64, 0x04, 0x00]);

			// Act
			const result = decompressLz4Block(data);

			// Assert
			expect(result.toString('utf8')).toBe('abcdabcd');
		});
	});
});
