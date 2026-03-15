import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdPause(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		await dispatcher.pauseCleaning(duid);
		console.log('Pause cleaning sent.');
	} finally {
		await clientRouter.disconnect();
	}
}
