import { AnsiLogger } from 'matterbridge/logger';

import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { CliSession } from '../types.js';

function tryParseDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(tryParseDeep);
	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tryParseDeep(v)]));
	}
	if (typeof value === 'string') {
		try {
			const parsed: unknown = JSON.parse(value);
			return tryParseDeep(parsed);
		} catch {
			return value;
		}
	}
	return value;
}

export async function cmdScenes(duid: string, session: CliSession, logger: AnsiLogger, detail = false): Promise<void> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const iotApi = new RoborockIoTApi(session.userData, logger);
	const scenes = await iotApi.getScenes(device.rrHomeId);

	if (!scenes || scenes.length === 0) {
		console.log('No scenes found.');
		return;
	}

	console.log(`Scenes for device ${duid}:\n`);
	scenes.forEach((scene, i) => {
		console.log(`  [${i + 1}] id:      ${scene.id}`);
		console.log(`      name:    ${scene.name}`);
		console.log(`      type:    ${scene.type}`);
		console.log(`      enabled: ${scene.enabled}`);
		console.log(`      extra: 	${scene.extra}`);
		if (detail) {
			const parsed = tryParseDeep(scene.param);
			const formatted = parsed !== undefined ? JSON.stringify(parsed) : (scene.param ?? '(none)');
			console.log(`      param:   ${formatted}`);
		}
		console.log('');
	});
}
