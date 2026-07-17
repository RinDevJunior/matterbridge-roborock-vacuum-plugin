import type { AnsiLogger } from 'matterbridge/logger';

import { Device } from '../../../roborockCommunication/models/device.js';
import type { RoborockService } from '../../../services/roborockService.js';
import { RoomMapping } from './RoomMapping.js';

export interface MapInfoPlatformContext {
	roborockService: RoborockService | undefined;
	log: AnsiLogger;
}

export interface MapReference {
	id: number;
	name: string | undefined;
}

export class RoomMap {
	constructor(private readonly roomMappings: RoomMapping[]) {}

	public get hasRooms(): boolean {
		return this.roomMappings.length > 0;
	}

	public get rooms(): RoomMapping[] {
		return this.roomMappings;
	}

	public getRooms(map_info: MapReference[], enableMultipleMap = false): RoomMapping[] {
		const mapid = map_info[0]?.id ?? 0;
		return enableMultipleMap
			? this.roomMappings
			: this.roomMappings.filter((room) => room.iot_map_id === undefined || room.iot_map_id === mapid);
	}

	public static async fromMapInfo(vacuum: Device, context: MapInfoPlatformContext): Promise<void> {
		if (!context.roborockService) {
			context.log.error('Roborock service not initialized');
			return;
		}
		await context.roborockService.getMapInfo(vacuum.duid);
		await context.roborockService.getRoomMap(vacuum.duid, -1);
	}

	public static empty(): RoomMap {
		return new RoomMap([]);
	}
}
