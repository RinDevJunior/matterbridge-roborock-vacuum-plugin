import { AnsiLogger } from 'matterbridge/logger';

import { computeFilterConditionPercent, FILTER_RATED_LIFE_SEC } from '../../model/ConsumableStatus.js';
import { RequestMessage } from '../../roborockCommunication/models/requestMessage.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';

const TIME_KEYS: readonly string[] = [
	'main_brush_work_time',
	'side_brush_work_time',
	'filter_work_time',
	'filter_element_work_time',
	'sensor_dirty_time',
];
const COUNT_KEYS: readonly string[] = ['strainer_work_times', 'dust_collection_work_times'];
const KNOWN_KEYS: readonly string[] = [...TIME_KEYS, ...COUNT_KEYS];

function secondsToHours(seconds: number): string {
	return `${(seconds / 3600).toFixed(1)} h`;
}

function describeKnownValue(key: string, value: unknown): string {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '(not reported)';
	if (key === 'filter_work_time') {
		const percent = computeFilterConditionPercent(value);
		return `${secondsToHours(value)} used, ${percent}% remaining (rated ${FILTER_RATED_LIFE_SEC / 3600} h)`;
	}
	if (COUNT_KEYS.includes(key)) return `${value} times`;
	return secondsToHours(value);
}

export function formatConsumableLines(raw: Record<string, unknown>): string[] {
	const width = Math.max(...[...KNOWN_KEYS, ...Object.keys(raw)].map((key) => key.length)) + 2;
	const formatRow = (key: string, value: string): string => `  ${`${key}:`.padEnd(width)}${value}`;

	const lines = KNOWN_KEYS.map((key) => formatRow(key, describeKnownValue(key, raw[key])));
	for (const [key, value] of Object.entries(raw)) {
		if (KNOWN_KEYS.includes(key) || typeof value !== 'number' || !Number.isFinite(value)) continue;
		lines.push(formatRow(key, `${value} (raw)`));
	}
	return lines;
}

export async function cmdConsumable(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		if (!dispatcher.getConsumableStatus) {
			console.log('Consumables are only available on V1 (non-B01) devices.');
			return;
		}
		const raw = await dispatcher.getCustomMessage<Record<string, unknown> | undefined>(
			duid,
			new RequestMessage({ method: 'get_consumable' }),
		);
		if (typeof raw !== 'object' || raw === null) {
			console.log('No consumable data received.');
			return;
		}
		console.log(`Consumables for device ${duid}:\n`);
		for (const line of formatConsumableLines(raw)) {
			console.log(line);
		}
	} finally {
		await clientRouter.disconnect();
	}
}
