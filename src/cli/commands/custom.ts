import { AnsiLogger } from 'matterbridge/logger';

import { RequestMessage } from '../../roborockCommunication/models/requestMessage.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdCustom(
	duid: string,
	method: string,
	params: unknown[] | Record<string, unknown> | undefined,
	send: boolean,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const request = new RequestMessage({ method, params });
		if (send) {
			await dispatcher.sendCustomMessage(duid, request);
			console.log(`Sent: ${method}`);
		} else {
			const result = await dispatcher.getCustomMessage(duid, request);
			console.log(`Response: ${JSON.stringify(result, null, 2)}`);
		}
	} finally {
		await clientRouter.disconnect();
	}
}
