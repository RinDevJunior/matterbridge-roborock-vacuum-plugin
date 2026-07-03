import { AnsiLogger } from 'matterbridge/logger';

import { LegacyMapParser } from '../../roborockCommunication/map/v1/mapParser.js';
import { decryptAndUnzipV1Map } from '../../roborockCommunication/map/v1/v1MapDecryptor.js';
import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import {
	extractNamedRooms,
	parseDeviceStatusPush,
	parseMapInfoPush,
	resolveActiveMapId,
	roomDisplayName,
} from '../mapListHelpers.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdLegacyMapInfo(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mapBinaryPromise = waitForPush(clientRouter, duid, (msg) => {
			const buf = msg.body?.get(Protocol.map_response);
			return Buffer.isBuffer(buf) ? buf : undefined;
		});
		const mapInfoPromise = waitForPush(clientRouter, duid, parseMapInfoPush);
		const statusPromise = waitForPush(clientRouter, duid, parseDeviceStatusPush);

		void dispatcher.getHomeMap(duid);
		void dispatcher.getMapInfo(duid);
		void dispatcher.getDeviceStatus(duid);
		console.log('Waiting for V1 map binary and room metadata...');

		const [rawBuffer, mapResult, statusResult] = await Promise.all([mapBinaryPromise, mapInfoPromise, statusPromise]);

		if (!rawBuffer) {
			console.log('No map binary received within timeout.');
			return;
		}

		const sessionNonce = clientRouter.getSerializeNonce();
		let mapBuffer: Buffer;
		try {
			mapBuffer = decryptAndUnzipV1Map(rawBuffer, sessionNonce);
		} catch (err) {
			console.error('Failed to decrypt V1 map binary:', err instanceof Error ? err.message : String(err));
			return;
		}

		const activeMapId = resolveActiveMapId(statusResult);
		const namedRooms = extractNamedRooms(mapResult, activeMapId);

		const parser = new LegacyMapParser();
		const mapData = parser.parse(mapBuffer);
		const currentRoom = parser.resolveCurrentRoom(mapData, namedRooms);

		console.log('\nRobot position:', mapData.robotPosition ?? 'not found');
		console.log('Current room:  ', currentRoom ?? 'could not determine');

		if (mapData.currentlyCleanedBlocks?.length) {
			console.log('Currently cleaned segments (task signal):', mapData.currentlyCleanedBlocks);
		}

		if (mapResult && namedRooms.length === 0) {
			console.log('(Room names unavailable — active map unknown or device returned no map list)');
		}

		console.log('\nSegments:');
		for (const seg of mapData.image?.segments.list ?? []) {
			const name = roomDisplayName(seg.id, namedRooms);
			console.log(`  [${seg.id}] ${name || '(unnamed)'}  center=${JSON.stringify(seg.center)}`);
		}

		console.log('\nSummary:', {
			imageSize: mapData.image?.dimensions,
			imagePosition: mapData.image?.position,
			floorPixelCount: mapData.image?.pixels.floor.length ?? 0,
			segmentPixelCount: mapData.image?.pixels.segments.length ?? 0,
			rawBufferBytes: mapBuffer.length,
		});
	} finally {
		await clientRouter.disconnect();
	}
}
