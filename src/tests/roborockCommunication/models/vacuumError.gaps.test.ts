import { describe, expect, it } from 'vitest';

import { DockErrorCode, VacuumErrorCode } from '../../../roborockCommunication/enums/index.js';
import { VacuumError } from '../../../roborockCommunication/models/vacuumError.js';

describe('VacuumError.isBinFull', () => {
	it('should return true when the vacuum error is CleanAutoEmptyDock', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.CleanAutoEmptyDock, DockErrorCode.None, undefined);
		// Act
		const result = error.isBinFull();
		// Assert
		expect(result).toBe(true);
	});

	it('should return true when the dock error is DuctBlockage', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.None, DockErrorCode.DuctBlockage, undefined);
		// Act
		const result = error.isBinFull();
		// Assert
		expect(result).toBe(true);
	});

	it('should return false when neither vacuum nor dock error indicates a full bin', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.None, DockErrorCode.None, undefined);
		// Act
		const result = error.isBinFull();
		// Assert
		expect(result).toBe(false);
	});
});

describe('VacuumError.isCleanWaterEmpty', () => {
	it('should return true when the vacuum error is ClearWaterTankEmpty', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.ClearWaterTankEmpty, DockErrorCode.None, undefined);
		// Act
		const result = error.isCleanWaterEmpty();
		// Assert
		expect(result).toBe(true);
	});

	it('should return true when the dock error is WaterEmpty', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.None, DockErrorCode.WaterEmpty, undefined);
		// Act
		const result = error.isCleanWaterEmpty();
		// Assert
		expect(result).toBe(true);
	});

	it('should return false when neither vacuum nor dock error indicates an empty clean tank', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.None, DockErrorCode.None, undefined);
		// Act
		const result = error.isCleanWaterEmpty();
		// Assert
		expect(result).toBe(false);
	});
});

describe('VacuumError.isWasteWaterFull', () => {
	it('should return true when the dock error is WasteWaterTankFull', () => {
		// Arrange
		const error = new VacuumError('duid', VacuumErrorCode.None, DockErrorCode.WasteWaterTankFull, undefined);
		// Act
		const result = error.isWasteWaterFull();
		// Assert
		expect(result).toBe(true);
	});
});
