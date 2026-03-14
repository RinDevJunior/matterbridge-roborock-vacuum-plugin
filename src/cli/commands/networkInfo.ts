import { AnsiLogger } from 'matterbridge/logger';

import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

export async function cmdNetworkInfo(duid: string, session: CliSession, logger: AnsiLogger): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger);
	try {
		const info = await dispatcher.getNetworkInfo(duid);
		if (!info) {
			console.log('Network info not supported for this device.');
			return;
		}
		console.log(`Network info for device ${duid}:\n`);
		console.log(`  ssid:  ${info.ssid}`);
		console.log(`  ip:    ${info.ip}`);
		console.log(`  mac:   ${info.mac}`);
		console.log(`  bssid: ${info.bssid}`);
		console.log(`  rssi:  ${info.rssi} dBm`);
	} finally {
		await clientRouter.disconnect();
	}
}
