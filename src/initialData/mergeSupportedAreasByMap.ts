import { ServiceArea } from 'matterbridge/matter/clusters';

import { RoomIndexMap } from '../core/application/models/RoomIndexMap.js';
import type { AreaInfo, SegmentInfo } from './getSupportedAreas.js';

export function mergeSupportedAreasByMap(
	existingAreas: ServiceArea.Area[],
	incomingAreas: ServiceArea.Area[],
	mapId: number,
	existingIndexMap: RoomIndexMap | undefined,
	incomingIndexMap: RoomIndexMap,
): { supportedAreas: ServiceArea.Area[]; roomIndexMap: RoomIndexMap } {
	const keptAreas = existingAreas.filter((a) => a.mapId !== mapId);
	const newForMap = incomingAreas.filter((a) => a.mapId === mapId);
	const merged = [...keptAreas, ...newForMap];
	const supportedAreas = merged.map((area, index) => ({ ...area, areaId: index }));

	const areaInfos = new Map<number, AreaInfo>();
	const roomInfos = new Map<string, SegmentInfo>();

	for (let i = 0; i < keptAreas.length; i++) {
		const oldAreaId = keptAreas[i].areaId;
		const info = existingIndexMap?.areaInfo.get(oldAreaId);
		if (!info) continue;
		areaInfos.set(i, info);
		const keptMapId = info.mapId ?? 0;
		roomInfos.set(`${info.roomId}-${keptMapId}`, {
			areaId: i,
			mapId: keptMapId,
			roomName: info.roomName,
		});
	}

	const offset = keptAreas.length;
	for (const [oldAreaId, info] of incomingIndexMap.areaInfo) {
		const newAreaId = offset + oldAreaId;
		areaInfos.set(newAreaId, info);
		const incomingMapId = info.mapId ?? mapId;
		roomInfos.set(`${info.roomId}-${incomingMapId}`, {
			areaId: newAreaId,
			mapId: incomingMapId,
			roomName: info.roomName,
		});
	}

	return {
		supportedAreas,
		roomIndexMap: new RoomIndexMap(areaInfos, roomInfos),
	};
}
