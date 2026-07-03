import { AnsiLogger } from 'matterbridge/logger';

import { B01MapParser } from '../../roborockCommunication/map/b01/b01MapParser.js';
import { resolveRoomFromPose } from '../../roborockCommunication/map/b01/roomMatrixResolver.js';
import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

export async function cmdB01PoseInfo(
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

		const parser = new B01MapParser();
		let b01Info: ReturnType<B01MapParser['parseRoomsFromEncryptedBinary']>;
		try {
			b01Info = parser.parseRoomsFromEncryptedBinary(rawBuffer, modelShortCode, deviceSerial);
		} catch (err) {
			console.error('Failed to decode B01 map binary:', err instanceof Error ? err.message : String(err));
			return;
		}

		const resolvedRoom = resolveRoomFromPose(b01Info.currentPose, b01Info.roomMatrix);

		console.log('\nRobot pose:', b01Info.currentPose ?? 'not found');
		console.log(
			'Resolved room:',
			resolvedRoom ?? 'could not determine — roomMatrix decoding not yet implemented, pending real-device capture',
		);

		console.log('\nRaw rooms (roomDataInfo):');
		for (const room of b01Info.rooms) {
			console.log(`  [${room.roomId}] ${room.roomName || '(unnamed)'}  labelPos=${JSON.stringify(room.labelPos)}`);
		}

		console.log(
			'\nRaw roomMatrix byte length (diagnostic only, not decoded):',
			b01Info.roomMatrix?.data.length ?? 'not found',
		);
	} finally {
		await clientRouter.disconnect();
	}
}
