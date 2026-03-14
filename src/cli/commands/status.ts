import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdStatus(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const status = await dispatcher.getDeviceStatus(duid);
		console.log('Device status:', JSON.stringify(status, null, 2));
	} finally {
		await clientRouter.disconnect();
	}
}
