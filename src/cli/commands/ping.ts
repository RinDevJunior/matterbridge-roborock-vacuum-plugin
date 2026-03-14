import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdPing(duid: string, session: CliSession, logger: AnsiLogger): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger);
	try {
		await dispatcher.findMyRobot(duid);
		console.log('Ping sent (find_me).');
	} finally {
		await clientRouter.disconnect();
	}
}
