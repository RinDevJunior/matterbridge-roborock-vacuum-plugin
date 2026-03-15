import { describe, expect, it } from 'vitest';

import { DeviceId } from '../../../../core/domain/value-objects/DeviceId.js';

describe('DeviceId', () => {
	describe('create', () => {
		it('should create a DeviceId for a valid string', () => {
			const id = DeviceId.create('abc12');
			expect(id.toString()).toBe('abc12');
		});

		it('should trim whitespace from the value', () => {
			const id = DeviceId.create('  abc12  ');
			expect(id.toString()).toBe('abc12');
		});

		it('should throw when value is empty string', () => {
			expect(() => DeviceId.create('')).toThrow('Device ID is required and must be a string');
		});

		it('should throw when value is less than 5 characters', () => {
			expect(() => DeviceId.create('ab')).toThrow('Device ID must be at least 5 characters long');
		});

		it('should throw when value is exactly 4 characters', () => {
			expect(() => DeviceId.create('abcd')).toThrow('Device ID must be at least 5 characters long');
		});

		it('should accept value of exactly 5 characters', () => {
			const id = DeviceId.create('abcde');
			expect(id.toString()).toBe('abcde');
		});
	});

	describe('toString', () => {
		it('should return the underlying string value', () => {
			const id = DeviceId.create('device-001');
			expect(id.toString()).toBe('device-001');
		});
	});

	describe('equals', () => {
		it('should return true for two DeviceIds with same value', () => {
			const a = DeviceId.create('device-001');
			const b = DeviceId.create('device-001');
			expect(a.equals(b)).toBe(true);
		});

		it('should return false for two DeviceIds with different values', () => {
			const a = DeviceId.create('device-001');
			const b = DeviceId.create('device-002');
			expect(a.equals(b)).toBe(false);
		});
	});
});
