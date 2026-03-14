import { AnsiLogger } from 'matterbridge/logger';

import { HomeModelMapper } from '../../roborockCommunication/models/home/mappers.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdRooms(duid: string, session: CliSession, logger: AnsiLogger): Promise<void> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger);
	try {
		const mapInfo = await dispatcher.getMapInfo(duid);
		console.log(`Room mapping for device ${duid}:\n`);

		if (mapInfo.hasRooms) {
			for (const map of mapInfo.maps) {
				console.log(`Map: ${map.name} (id=${map.id})`);
				for (const room of map.rooms) {
					const mapping = HomeModelMapper.toRoomMapping(room, device.store.homeData.rooms);
					console.log(
						`  id=${mapping.id}  tag=${mapping.tag}  iot_name_id=${mapping.iot_name_id}  name=${mapping.iot_name ?? '(unknown)'}`,
					);
				}
				console.log('');
			}
			return;
		}

		// Fallback: get raw room mapping
		const activeMapId = mapInfo.maps[0]?.id ?? 0;
		const rawData = await dispatcher.getRoomMap(duid, activeMapId);
		if (rawData.length === 0) {
			console.log('No room mapping found.');
			return;
		}
		console.log('Room mapping (fallback):');
		for (const raw of rawData) {
			const dto = HomeModelMapper.rawArrayToMapRoomDto(raw, activeMapId);
			const mapping = HomeModelMapper.toRoomMapping(dto, device.store.homeData.rooms);
			console.log(
				`  id=${mapping.id}  tag=${mapping.tag}  iot_name_id=${mapping.iot_name_id}  name=${mapping.iot_name ?? '(unknown)'}`,
			);
		}
	} finally {
		await clientRouter.disconnect();
	}
}
