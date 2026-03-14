import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdStop(duid: string, session: CliSession, logger: AnsiLogger): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger);
	try {
		await dispatcher.stopCleaning(duid);
		console.log('Stop cleaning sent.');
	} finally {
		await clientRouter.disconnect();
	}
}
