import { LogLevel } from 'matterbridge/logger';
import { AnsiLogger } from 'matterbridge/logger';

import { cmdCustom } from './commands/custom.js';
import { cmdDevices } from './commands/devices.js';
import { cmdLogin } from './commands/login.js';
import { cmdMapInfo } from './commands/mapInfo.js';
import { cmdPause } from './commands/pause.js';
import { cmdPing } from './commands/ping.js';
import { cmdRooms } from './commands/rooms.js';
import { cmdStart } from './commands/start.js';
import { cmdStatus } from './commands/status.js';
import { cmdStop } from './commands/stop.js';
import { HELP_TEXT } from './help.js';
import { loadSession } from './session.js';
import { parseArgs } from './utils.js';

export async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const command = args['command'];

	const help = args['help'] === 'true';
	if (!command || command === 'help' || help) {
		console.log(HELP_TEXT);
		process.exit(command || help ? 0 : 1);
	}

	const debug = args['debug'] === 'true';
	const logger = AnsiLogger.create({ logName: 'CLI', logLevel: debug ? LogLevel.DEBUG : LogLevel.WARN });

	try {
		if (command === 'login') {
			await cmdLogin(logger);
			return;
		}

		const session = loadSession();
		if (!session) {
			console.error('No session found. Run: npm run cli -- --command login');
			process.exit(1);
		}

		if (command === 'devices') {
			await cmdDevices(session, logger);
			return;
		}

		const duid = args['duid'];
		if (!duid) {
			console.error(`--duid is required for command: ${command}`);
			process.exit(1);
		}

		switch (command) {
			case 'status':
				await cmdStatus(duid, session, logger);
				break;
			case 'start':
				await cmdStart(duid, session, logger);
				break;
			case 'stop':
				await cmdStop(duid, session, logger);
				break;
			case 'pause':
				await cmdPause(duid, session, logger);
				break;
			case 'ping':
				await cmdPing(duid, session, logger);
				break;
			case 'room-info':
				await cmdRooms(duid, session, logger);
				break;
			case 'map-info':
				await cmdMapInfo(duid, session, logger);
				break;
			case 'custom': {
				const method = args['method'];
				if (!method) {
					console.error('--method is required for command: custom');
					process.exit(1);
				}
				const rawParams = args['params'];
				const params = rawParams ? (JSON.parse(rawParams) as unknown[] | Record<string, unknown>) : undefined;
				const send = args['send'] === 'true';
				await cmdCustom(duid, method, params, send, session, logger);
				break;
			}
			default:
				console.error(`Unknown command: ${command}\n\n${HELP_TEXT}`);
				process.exit(1);
		}
	} catch (err) {
		console.error('Error:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
