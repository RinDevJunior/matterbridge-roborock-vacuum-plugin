import fs from 'node:fs';

import { CliSession, SESSION_FILE } from './types.js';

export function loadSession(): CliSession | null {
	try {
		return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as CliSession;
	} catch {
		return null;
	}
}

export function saveSession(session: CliSession): void {
	fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}
