import { AnsiLogger } from 'matterbridge/logger';

import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { buildDevices } from '../deviceBuilder.js';
import { saveSession } from '../session.js';
import { DEFAULT_BASE_URL } from '../types.js';
import { prompt } from '../utils.js';

export async function cmdLogin(logger: AnsiLogger): Promise<void> {
	const email = await prompt('Email: ');
	const authClient = new RoborockAuthenticateApi(logger, undefined, undefined, DEFAULT_BASE_URL);

	console.log('Sending verification code...');
	await authClient.requestCodeV4(email);

	const code = await prompt('Verification code: ');
	const userData = await authClient.loginWithCodeV4(email, code);
	console.log(`Logged in as: ${userData.username}`);

	const homeInfo = await authClient.getBasicHomeInfo();
	if (!homeInfo?.rrHomeId) throw new Error('No home found');

	const iotApi = new RoborockIoTApi(userData, logger);
	const homeData = await iotApi.getHomeWithProducts(homeInfo.rrHomeId);
	if (!homeData) throw new Error('Failed to fetch home data');

	const devices = buildDevices(homeData, homeInfo.rrHomeId, userData);
	saveSession({ email, userData, devices });

	console.log(`Session saved. Found ${devices.length} device(s).`);
	devices.forEach((d) => console.log(`  • ${d.duid}  ${d.name}  model=${d.specs.model}  pv=${d.pv}`));
}
