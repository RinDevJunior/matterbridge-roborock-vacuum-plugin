import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdResume(duid: string, session: CliSession, logger: AnsiLogger, local = false): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		await dispatcher.resumeCleaning(duid);
		console.log('Resume cleaning sent.');
	} finally {
		await clientRouter.disconnect();
	}
}
