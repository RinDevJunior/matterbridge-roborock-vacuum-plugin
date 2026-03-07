import { describe, it, expect } from 'vitest';
import decodeComponent from '../../../roborockCommunication/helper/nameDecoder.js';

describe('nameDecoder', () => {
	it('returns undefined for undefined input (case 1)', () => {
		expect(decodeComponent(undefined)).toBeUndefined();
	});

	it('decodes normal encoded URIs (case 1)', () => {
		expect(decodeComponent('Hello%20World')).toBe('Hello World');
	});

	it('handles special replacement tokens (case 1)', () => {
		expect(decodeComponent('%FE%FF')).toBe('\uFFFD\uFFFD');
		expect(decodeComponent('%C2')).toBe('\uFFFD');
	});
});

describe('nameDecoder (case 2)', () => {
	it('returns undefined for undefined input (case 2)', () => {
		expect(decodeComponent(undefined)).toBeUndefined();
	});

	it('decodes normal encoded URIs (case 2)', () => {
		expect(decodeComponent('Hello%20World')).toBe('Hello World');
	});

	it('handles malformed URI sequences', () => {
		const malformed = '%E0%A4%A';
		const result = decodeComponent(malformed);
		expect(typeof result).toBe('string');
		expect(result).toBeDefined();
	});

	it('handles FF FE sequences', () => {
		expect(decodeComponent('%FF%FE')).toBe('\uFFFD\uFFFD');
	});

	it('handles complex multi-byte sequences', () => {
		const complex = '%C3%28%41';
		const result = decodeComponent(complex);
		expect(typeof result).toBe('string');
	});
});
