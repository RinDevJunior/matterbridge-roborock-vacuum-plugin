import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdMapInfo(duid: string, session: CliSession, logger: AnsiLogger): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger);
	try {
		const mapInfo = await dispatcher.getMapInfo(duid);

		if (mapInfo.maps.length === 0) {
			console.log('No map info found.');
			return;
		}

		console.log(`Map info for device ${duid}:\n`);
		for (const map of mapInfo.maps) {
			console.log(`Map: ${map.name} (id=${map.id})  rooms=${map.rooms.length}`);
			for (const room of map.rooms) {
				console.log(
					`  id=${room.id}  tag=${room.tag}  iot_name_id=${room.iot_name_id}  name=${room.iot_name ?? '(unknown)'}`,
				);
			}
			console.log('');
		}
	} finally {
		await clientRouter.disconnect();
	}
}
