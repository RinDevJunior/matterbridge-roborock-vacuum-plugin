import { describe, expect, it } from 'vitest';

import { DockType } from '../../../roborockCommunication/enums/dockType.js';
import { DockInfo } from '../../../roborockCommunication/models/dockInfo.js';

describe('DockInfo', () => {
	it('can be instantiated with a DockType', () => {
		const info = new DockInfo(DockType.qrevo_curv_dock);
		expect(info).toBeDefined();
		expect(info).toBeInstanceOf(DockInfo);
	});

	it('should construct when given type_49_dock', () => {
		// Arrange
		const dockType = DockType.type_49_dock;

		// Act
		const info = new DockInfo(dockType);

		// Assert
		expect(info).toBeInstanceOf(DockInfo);
	});

	it('should map type_49_dock to the value 49 and back to its name', () => {
		// Arrange
		const expectedValue = 49;
		const expectedName = 'type_49_dock';

		// Act
		const value = DockType.type_49_dock;
		const name = DockType[49];

		// Assert
		expect(value).toBe(expectedValue);
		expect(name).toBe(expectedName);
	});
});
