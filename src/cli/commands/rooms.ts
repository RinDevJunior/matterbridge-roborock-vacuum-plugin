import { AnsiLogger } from 'matterbridge/logger';

import { HomeModelMapper } from '../../roborockCommunication/models/home/mappers.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdRooms(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const rawData = await dispatcher.getRoomMap(duid, -1);

		if (rawData.length === 0) {
			console.log('No room mapping found.');
			return;
		}

		console.log(`Room mapping for device ${duid}:\n`);
		for (const raw of rawData) {
			const dto = HomeModelMapper.rawArrayToMapRoomDto(raw, 0);
			const mapping = HomeModelMapper.toRoomMapping(dto, device.store.homeData.rooms);
			console.log(`  id=${mapping.id}  tag=${mapping.tag}  iot_name_id=${mapping.iot_name_id}`);
		}
	} finally {
		await clientRouter.disconnect();
	}
}
