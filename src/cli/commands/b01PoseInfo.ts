import fs from 'node:fs';
import path from 'node:path';

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

		if (b01Info.headerUnknownByte6 !== undefined) {
			console.log(
				`\nUnused header byte (offset 6, diagnostic — unconfirmed): ${b01Info.headerUnknownByte6} (0x${b01Info.headerUnknownByte6.toString(16).padStart(2, '0')})`,
			);
		}

		if (b01Info.headerReserved) {
			const reserved = b01Info.headerReserved;
			console.log('\nUnused header bytes (offsets 11-26, diagnostic — meaning unconfirmed):');
			console.log('  hex:', reserved.toString('hex'));

			if (reserved.length >= 16) {
				const int32Pairs = [0, 4, 8, 12].map((offset) => ({
					offset,
					int32: reserved.readInt32BE(offset),
					uint32: reserved.readUInt32BE(offset),
				}));
				console.log('  as int32BE/uint32BE @ offsets 0,4,8,12 (e.g. possible origin X/Y pair):');
				for (const { offset, int32, uint32 } of int32Pairs) {
					console.log(`    [${offset}] int32=${int32}  uint32=${uint32}`);
				}

				const int16Values = [0, 2, 4, 6, 8, 10, 12, 14].map((offset) => ({
					offset,
					int16: reserved.readInt16BE(offset),
					uint16: reserved.readUInt16BE(offset),
				}));
				console.log('  as int16BE/uint16BE @ offsets 0,2,4,6,8,10,12,14 (e.g. possible scale/origin fields):');
				for (const { offset, int16, uint16 } of int16Values) {
					console.log(`    [${offset}] int16=${int16}  uint16=${uint16}`);
				}
			}
		}

		console.log('\nRaw rooms (roomDataInfo):');
		for (const room of b01Info.rooms) {
			console.log(`  [${room.roomId}] ${room.roomName || '(unnamed)'}  labelPos=${JSON.stringify(room.labelPos)}`);
		}

		if (b01Info.roomMatrix?.data) {
			const matrixData = b01Info.roomMatrix.data;
			console.log('\nRaw roomMatrix byte length (diagnostic only, not decoded):', matrixData.length);
			console.log(
				`Raw roomMatrix grid: ${b01Info.roomMatrix.width}x${b01Info.roomMatrix.height} (diagnostic only, not decoded)`,
			);
			console.log(
				'Raw roomMatrix first bytes (hex, diagnostic only, not decoded):',
				matrixData.subarray(0, 64).toString('hex'),
			);

			const diagnosticsDir = path.join(process.cwd(), '.diagnostics');
			fs.mkdirSync(diagnosticsDir, { recursive: true });
			const dumpPath = path.join(diagnosticsDir, `roomMatrix-${duid}-${Date.now()}.bin`);
			fs.writeFileSync(dumpPath, matrixData);
			console.log('Full roomMatrix buffer written to:', dumpPath);
		} else {
			console.log('\nRaw roomMatrix byte length (diagnostic only, not decoded): not found');
		}
	} finally {
		await clientRouter.disconnect();
	}
}
