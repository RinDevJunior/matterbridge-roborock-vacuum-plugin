const LOCAL_SENDER = 'local (no remote session)';
const PASE_SENDER = 'commissioning (PASE) session';
const UNKNOWN_SENDER = 'unknown sender';
const MAX_LABEL_LENGTH = 32;

function readField(parent: unknown, key: string): unknown {
	if (typeof parent !== 'object' || parent === null) return undefined;
	const value: unknown = Reflect.get(parent, key);
	return value;
}

function toHex(value: unknown): string | undefined {
	if (typeof value === 'bigint') return `0x${value.toString(16)}`;
	if (typeof value === 'number' && Number.isInteger(value)) return `0x${value.toString(16)}`;
	return undefined;
}

function sanitizeLabel(label: string): string {
	return [...label]
		.filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
		.join('')
		.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Describes the Matter controller that issued a command, from matter.js ActionContext.
 * Only fabric index, fabric label, peer node id and session id are read; keys, challenges,
 * message payloads and transport addresses are never touched. Never throws.
 */
export function describeCommandSender(context: unknown): string {
	try {
		const fabric = readField(context, 'fabric');
		const session = readField(context, 'session');
		if (typeof fabric !== 'number' || session === undefined || session === null) return LOCAL_SENDER;
		if (fabric === 0 || readField(session, 'isPase') === true) return PASE_SENDER;

		const rawLabel = readField(readField(session, 'fabric'), 'label');
		const label = typeof rawLabel === 'string' ? sanitizeLabel(rawLabel) : '';
		const peerNode = toHex(readField(readField(context, 'subject'), 'id') ?? readField(session, 'peerNodeId'));
		const sessionId = toHex(readField(session, 'id'));

		const details = [`fabric ${fabric}${label ? ` "${label}"` : ''}`];
		if (peerNode) details.push(`peer node ${peerNode}`);
		if (sessionId) details.push(`session ${sessionId}`);
		return details.join(', ');
	} catch {
		return UNKNOWN_SENDER;
	}
}
