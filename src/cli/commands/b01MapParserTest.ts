import { AnsiLogger } from 'matterbridge/logger';

import { B01MapParser } from '../../roborockCommunication/map/b01/b01MapParser.js';
import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

/**
 * Diagnostic-only inference of which payload shape the raw buffer looks like, mirroring
 * B01MapParser's private isQ10ShapedPayload() check without touching production logic.
 */
function classifyPayloadShape(rawBuffer: Buffer): 'Q10-shaped' | 'Q7-shaped' {
	return rawBuffer.length >= 2 && rawBuffer[0] === 0x01 && rawBuffer[1] === 0x01 ? 'Q10-shaped' : 'Q7-shaped';
}

export async function cmdB01MapParserTest(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<void> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const modelShortCode = device.specs.model.split('.').at(-1);
	const deviceSerial = device.serialNumber;
	if (!modelShortCode) {
		console.error('Could not determine device model short code.');
		return;
	}

	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mapBinaryPromise = waitForPush(clientRouter, duid, (msg) => {
			const buf = msg.body?.get(Protocol.map_response);
			return Buffer.isBuffer(buf) ? buf : undefined;
		});

		void dispatcher.getMapInfo(duid);
		console.log('Waiting for B01 map binary...');

		const rawBuffer = await mapBinaryPromise;
		if (!rawBuffer) {
			console.log('No map binary received within timeout.');
			return;
		}

		const shape = classifyPayloadShape(rawBuffer);
		console.log(`\nPayload classification (inferred from leading bytes): ${shape}`);
		console.log(
			`Raw buffer length: ${rawBuffer.length} bytes, first bytes: ${rawBuffer.subarray(0, 8).toString('hex')}`,
		);

		if (shape === 'Q10-shaped' && rawBuffer.length >= 11) {
			const width = rawBuffer.readUInt16BE(7);
			const height = rawBuffer.readUInt16BE(9);
			console.log(`Inferred Q10 header dimensions: width=${width}, height=${height}`);
		}

		const parser = new B01MapParser();
		try {
			const b01Info = parser.parseRoomsFromEncryptedBinary(rawBuffer, modelShortCode, deviceSerial);

			console.log('\nParse result: SUCCESS');
			console.log(`mapId: ${b01Info.mapId ?? 'not found'}`);
			console.log(`Decoded room count: ${b01Info.rooms.length}`);
			console.log('\nRooms:');
			for (const room of b01Info.rooms) {
				console.log(`  [${room.roomId}] ${room.roomName || '(unnamed)'}`);
			}
		} catch (err) {
			console.log('\nParse result: FAILURE');
			console.error('Error message (please share this back for a real hardware capture):');
			console.error(err instanceof Error ? err.message : String(err));
		}
	} finally {
		await clientRouter.disconnect();
	}
}
