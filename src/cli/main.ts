import { LogLevel } from 'matterbridge/logger';
import { AnsiLogger } from 'matterbridge/logger';

import { cmdDevices } from './commands/devices.js';
import { cmdLogin } from './commands/login.js';
import { cmdPause } from './commands/pause.js';
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

	if (!command || command === 'help') {
		console.log(HELP_TEXT);
		process.exit(command ? 0 : 1);
	}

	const logger = AnsiLogger.create({ logName: 'CLI', logLevel: LogLevel.WARN });

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

		switch (command) {
			case 'devices':
				await cmdDevices(session, logger);
				break;
			case 'status':
			case 'start':
			case 'stop':
			case 'pause':
			case 'rooms': {
				const duid = args['duid'];
				if (!duid) {
					console.error(`--duid is required for command: ${command}`);
					process.exit(1);
				}
				if (command === 'status') await cmdStatus(duid, session, logger);
				else if (command === 'start') await cmdStart(duid, session, logger);
				else if (command === 'stop') await cmdStop(duid, session, logger);
				else if (command === 'pause') await cmdPause(duid, session, logger);
				else await cmdRooms(duid, session, logger);
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
