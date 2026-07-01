import { AnsiLogger } from 'matterbridge/logger';

import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdMapInfo(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mapInfoPromise = waitForPush(clientRouter, duid, (msg) => {
			const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
				| { result?: unknown }
				| undefined;
			if (!dps?.result) return undefined;
			const raw = Array.isArray(dps.result) ? dps.result[0] : dps.result;
			if (raw && typeof raw === 'object' && 'map_info' in raw) return raw;
			return undefined;
		});

		const statusPromise = waitForPush(clientRouter, duid, (msg) => {
			const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
				| { result?: unknown }
				| undefined;
			if (!dps?.result) return undefined;
			const raw = Array.isArray(dps.result) ? dps.result[0] : dps.result;
			if (raw && typeof raw === 'object' && 'map_status' in raw) return raw;
			return undefined;
		});

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

function resolveActiveMapId(status: unknown): number | undefined {
	if (!status || typeof status !== 'object') return undefined;
	const mapStatus = (status as Record<string, unknown>).map_status;
	if (typeof mapStatus !== 'number') return undefined;
	const mapFlag = mapStatus >> 2;
	return mapFlag !== 63 ? mapFlag : undefined;
}
