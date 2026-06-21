import { AnsiLogger } from 'matterbridge/logger';

import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdRooms(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const resultPromise = waitForPush(clientRouter, duid, (msg) => {
			const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
				| { result?: unknown }
				| undefined;
			if (!dps?.result) return undefined;
			const raw = dps.result;
			if (
				Array.isArray(raw) &&
				raw.length > 0 &&
				Array.isArray(raw[0]) &&
				typeof raw[0][0] === 'number' &&
				typeof raw[0][1] === 'string'
			) {
				return raw as [number, string, number?][];
			}
			return undefined;
		});

		await dispatcher.getRoomMap(duid, -1);
		console.log('Waiting for room map response...');

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
