import { describe, expect, it } from 'vitest';

import { MapRoom } from '../../../../core/application/models/MapRoom.js';
import type { MapRoomDto } from '../../../../roborockCommunication/models/home/index.js';
import { asType } from '../../../helpers/testUtils.js';

describe('MapRoom (gap coverage)', () => {
	it('should use the bare id as alternativeId when the dto has no tag', () => {
		// Arrange
		const dto = asType<MapRoomDto>({ id: 9, iot_name_id: 'room9' });

		// Act
		const room = MapRoom.fromDto(dto, 'Den');

		// Assert
		expect(room.alternativeId).toBe('9');
		expect(room.iot_name).toBe('Den');
	});
});
