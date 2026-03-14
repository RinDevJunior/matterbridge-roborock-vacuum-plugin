import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdCleanMode(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mode = await dispatcher.getCleanModeData(duid);
		console.log(`Clean mode for device ${duid}:\n`);
		console.log(`  suction_power: ${mode.suctionPower}`);
		console.log(`  water_flow:    ${mode.waterFlow}`);
		console.log(`  distance_off:  ${mode.distance_off}`);
		console.log(`  mop_route:     ${mode.mopRoute ?? '(not supported)'}`);
		console.log(`  sequence_type: ${mode.sequenceType ?? '(not supported)'}`);
	} finally {
		await clientRouter.disconnect();
	}
}
