import { AnsiLogger } from 'matterbridge/logger';

import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { buildDevices } from '../deviceBuilder.js';
import { saveSession } from '../session.js';
import { CliSession } from '../types.js';

export async function cmdDevices(session: CliSession, logger: AnsiLogger): Promise<void> {
	const iotApi = new RoborockIoTApi(session.userData, logger);
	const authClient = new RoborockAuthenticateApi(logger);
	await authClient.loginWithUserData(session.email, session.userData);

	const homeInfo = await authClient.getBasicHomeInfo();
	if (!homeInfo?.rrHomeId) throw new Error('No home found');

	const homeData = await iotApi.getHomeWithProducts(homeInfo.rrHomeId);
	if (!homeData) throw new Error('Failed to fetch home data');

	const devices = buildDevices(homeData, homeInfo.rrHomeId, session.userData);
	saveSession({ email: session.email, userData: session.userData, devices });

	console.log(`Found ${devices.length} device(s):\n`);
	devices.forEach((d, i) => {
		console.log(`  [${i + 1}] duid:     ${d.duid}`);
		console.log(`      name:     ${d.name}`);
		console.log(`      model:    ${d.specs.model}`);
		console.log(`      pv:       ${d.pv}`);
		console.log(`      firmware: ${d.fv}`);
		console.log(`      online:   ${d.online}\n`);
	});
}
