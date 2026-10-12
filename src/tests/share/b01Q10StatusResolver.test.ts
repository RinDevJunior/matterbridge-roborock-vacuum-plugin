import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	B01Q10OperationStatusCode,
	OperationStatusCode,
	ProtocolVersion,
} from '../../roborockCommunication/enums/index.js';
import { DeviceModel } from '../../roborockCommunication/models/index.js';
import { isB01Q10CleaningState, isB01Q10IdleState, isB01Q10Robot } from '../../share/b01Q10StatusResolver.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial } from '../helpers/testUtils.js';

describe('isB01Q10CleaningState', () => {
	it('should return true for Sweeping (102)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.Sweeping)).toBe(true);
	});

	it('should return true for SweepAndMop (104)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.SweepAndMop)).toBe(true);
	});

	it('should return true for Relocating (101)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.Relocating)).toBe(true);
	});

	it('should return true for Mopping (103)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.Mopping)).toBe(true);
	});

	it('should return false for Transitioning (105)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.Transitioning)).toBe(false);
	});

	it('should return false for WaitingToCharge (108)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.WaitingToCharge)).toBe(false);
	});

	it('should return false for SavingMap (99)', () => {
		expect(isB01Q10CleaningState(B01Q10OperationStatusCode.SavingMap)).toBe(false);
	});

	it('should return false for canonical Cleaning code (5)', () => {
		expect(isB01Q10CleaningState(OperationStatusCode.Cleaning)).toBe(false);
	});

	it('should return false for arbitrary unrelated number (999)', () => {
		expect(isB01Q10CleaningState(999)).toBe(false);
	});
});

describe('isB01Q10IdleState', () => {
	it('should return true for Transitioning (105)', () => {
		expect(isB01Q10IdleState(B01Q10OperationStatusCode.Transitioning)).toBe(true);
	});

	it('should return false for Sweeping (102)', () => {
		expect(isB01Q10IdleState(B01Q10OperationStatusCode.Sweeping)).toBe(false);
	});

	it('should return false for SweepAndMop (104)', () => {
		expect(isB01Q10IdleState(B01Q10OperationStatusCode.SweepAndMop)).toBe(false);
	});

	it('should return false for canonical Idle code (3)', () => {
		expect(isB01Q10IdleState(OperationStatusCode.Idle)).toBe(false);
	});

	it('should return false for arbitrary unrelated number (999)', () => {
		expect(isB01Q10IdleState(999)).toBe(false);
	});
});

describe('isB01Q10Robot', () => {
	it('should return true when protocol is B01 and model short code starts with ss', () => {
		const robot = asPartial<RoborockVacuumCleaner>({
			device: asPartial<any>({
				pv: ProtocolVersion.B01,
				specs: {
					model: DeviceModel.Q10_S5_PLUS,
				},
			}),
		});

		expect(isB01Q10Robot(robot)).toBe(true);
	});

	it('should return false when protocol is B01 but model short code starts with sc (Q7)', () => {
		const robot = asPartial<RoborockVacuumCleaner>({
			device: asPartial<any>({
				pv: ProtocolVersion.B01,
				specs: {
					model: DeviceModel.Q7,
				},
			}),
		});

		expect(isB01Q10Robot(robot)).toBe(false);
	});

	it('should return false when protocol is V1', () => {
		const robot = asPartial<RoborockVacuumCleaner>({
			device: asPartial<any>({
				pv: ProtocolVersion.V1,
				specs: {
					model: DeviceModel.S5,
				},
			}),
		});

		expect(isB01Q10Robot(robot)).toBe(false);
	});

	it('should return false when model is undefined', () => {
		const robot = asPartial<RoborockVacuumCleaner>({
			device: asPartial<any>({
				pv: ProtocolVersion.B01,
				specs: {
					model: undefined,
				},
			}),
		});

		expect(isB01Q10Robot(robot)).toBe(false);
	});
});
