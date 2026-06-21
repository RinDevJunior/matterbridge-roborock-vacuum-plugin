import { AnsiLogger } from 'matterbridge/logger';

import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdStatus(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const resultPromise = waitForPush(clientRouter, duid, (msg) => {
			const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
				| { result?: unknown }
				| undefined;
			if (!dps?.result) return undefined;
			const raw = Array.isArray(dps.result) ? dps.result[0] : dps.result;
			if (raw && typeof raw === 'object' && 'state' in raw) return raw;
			return undefined;
		});

		await dispatcher.getDeviceStatus(duid);
		console.log('Waiting for device status response...');

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
