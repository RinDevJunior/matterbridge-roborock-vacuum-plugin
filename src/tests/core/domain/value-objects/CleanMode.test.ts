import { describe, expect, it } from 'vitest';

import { CleanMode } from '../../../../core/domain/value-objects/CleanMode.js';

describe('CleanMode', () => {
	describe('static instances', () => {
		it('should have Vacuum instance', () => {
			expect(CleanMode.Vacuum.toString()).toBe('vacuum');
		});

		it('should have Mop instance', () => {
			expect(CleanMode.Mop.toString()).toBe('mop');
		});

		it('should have VacuumAndMop instance', () => {
			expect(CleanMode.VacuumAndMop.toString()).toBe('vacuum_and_mop');
		});
	});

	describe('fromString', () => {
		it('should return Vacuum for "vacuum"', () => {
			expect(CleanMode.fromString('vacuum')).toBe(CleanMode.Vacuum);
		});

		it('should return Mop for "mop"', () => {
			expect(CleanMode.fromString('mop')).toBe(CleanMode.Mop);
		});

		it('should return VacuumAndMop for "vacuum_and_mop"', () => {
			expect(CleanMode.fromString('vacuum_and_mop')).toBe(CleanMode.VacuumAndMop);
		});

		it('should normalize to lowercase', () => {
			expect(CleanMode.fromString('VACUUM')).toBe(CleanMode.Vacuum);
			expect(CleanMode.fromString('MOP')).toBe(CleanMode.Mop);
			expect(CleanMode.fromString('VACUUM_AND_MOP')).toBe(CleanMode.VacuumAndMop);
		});

		it('should trim whitespace', () => {
			expect(CleanMode.fromString('  vacuum  ')).toBe(CleanMode.Vacuum);
		});

		it('should create custom mode for unknown values', () => {
			const custom = CleanMode.fromString('turbo');
			expect(custom.toString()).toBe('turbo');
		});

		it('custom modes should not equal static instances', () => {
			const custom = CleanMode.fromString('turbo');
			expect(custom.equals(CleanMode.Vacuum)).toBe(false);
		});
	});

	describe('toString', () => {
		it('should return the value string', () => {
			expect(CleanMode.Vacuum.toString()).toBe('vacuum');
			expect(CleanMode.Mop.toString()).toBe('mop');
			expect(CleanMode.VacuumAndMop.toString()).toBe('vacuum_and_mop');
		});
	});

	describe('equals', () => {
		it('should return true for same static instances', () => {
			expect(CleanMode.Vacuum.equals(CleanMode.Vacuum)).toBe(true);
		});

		it('should return false for different modes', () => {
			expect(CleanMode.Vacuum.equals(CleanMode.Mop)).toBe(false);
		});

		it('should return true for two custom modes with same value', () => {
			const a = CleanMode.fromString('turbo');
			const b = CleanMode.fromString('turbo');
			expect(a.equals(b)).toBe(true);
		});
	});
});
