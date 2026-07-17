import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { parseDeviceStatusPush, parseMapInfoPush, resolveActiveMapId } from '../mapListHelpers.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdMapInfo(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mapInfoPromise = waitForPush(clientRouter, duid, parseMapInfoPush);
		const statusPromise = waitForPush(clientRouter, duid, parseDeviceStatusPush);

		await dispatcher.getMapInfo(duid);
		await dispatcher.getDeviceStatus(duid);
		console.log('Waiting for map info response...');

		const [mapResult, statusResult] = await Promise.all([mapInfoPromise, statusPromise]);

		if (!mapResult) {
			console.log('No response received within timeout.');
			return;
		}

		const activeMapId = resolveActiveMapId(statusResult);

		const maps = (mapResult as { map_info?: { mapFlag?: number; name?: string }[] }).map_info ?? [];
		console.log('\nMaps:');
		for (const map of maps) {
			const id = map.mapFlag ?? '?';
			const name = map.name ?? '(unnamed)';
			const active = activeMapId !== undefined && map.mapFlag === activeMapId ? ' [ACTIVE]' : '';
			console.log(`  ${id}  ${name}${active}`);
		}

		console.log('\nRaw response:');
		console.log(JSON.stringify(mapResult, null, 2));
	} finally {
		await clientRouter.disconnect();
	}
}
