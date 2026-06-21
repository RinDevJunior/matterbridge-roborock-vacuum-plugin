import { AnsiLogger } from 'matterbridge/logger';

import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdMapInfo(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const resultPromise = waitForPush(clientRouter, duid, (msg) => {
			const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
				| { result?: unknown }
				| undefined;
			if (!dps?.result) return undefined;
			const raw = Array.isArray(dps.result) ? dps.result[0] : dps.result;
			if (raw && typeof raw === 'object' && 'map_info' in raw) return raw;
			return undefined;
		});

		await dispatcher.getMapInfo(duid);
		console.log('Waiting for map info response...');

		const result = await resultPromise;
		if (result) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log('No response received within timeout.');
		}
	} finally {
		await clientRouter.disconnect();
	}
}
