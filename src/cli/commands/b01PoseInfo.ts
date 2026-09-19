import { AnsiLogger } from 'matterbridge/logger';

import { B01MapParser } from '../../roborockCommunication/map/b01/b01MapParser.js';
import { B01TracePoint } from '../../roborockCommunication/map/b01/b01Q10TraceParser.js';
import { solveQ10GridCalibration } from '../../roborockCommunication/map/b01/q10GridCalibration.js';
import { resolveRoomFromPose } from '../../roborockCommunication/map/b01/roomMatrixResolver.js';
import { B01Pose } from '../../roborockCommunication/map/b01/types.js';
import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

const MAX_TRACE_ITERATIONS = 10;
const MAX_TRACE_BUDGET_MS = 60_000;
const MIN_TRACE_POINTS = 4;

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

		const points: B01TracePoint[] = [];
		let lastPose: B01Pose | undefined = b01Info.currentPose;
		if (b01Info.currentPose) {
			points.push({ x: b01Info.currentPose.x, y: b01Info.currentPose.y });
		}

		const traceDeadline = Date.now() + MAX_TRACE_BUDGET_MS;
		let iteration = 0;
		while (points.length < MIN_TRACE_POINTS && iteration < MAX_TRACE_ITERATIONS && Date.now() < traceDeadline) {
			iteration++;
			const tracePushPromise = waitForPush(clientRouter, duid, (msg) => {
				const buf = msg.body?.get(Protocol.map_response);
				return Buffer.isBuffer(buf) ? buf : undefined;
			});
			void dispatcher.getMapInfo(duid);
			const traceBuffer = await tracePushPromise;
			if (!traceBuffer) {
				break;
			}
			try {
				const traceInfo = parser.parseRoomsFromEncryptedBinary(traceBuffer, modelShortCode, deviceSerial);
				if (traceInfo.currentPose) {
					lastPose = traceInfo.currentPose;
					points.push({ x: traceInfo.currentPose.x, y: traceInfo.currentPose.y });
				}
			} catch (err) {
				console.error('Failed to decode Q10 trace binary:', err instanceof Error ? err.message : String(err));
			}
		}

		const calibration = b01Info.roomMatrix ? solveQ10GridCalibration(points, b01Info.roomMatrix) : undefined;
		const resolvedRoom = resolveRoomFromPose(lastPose, b01Info.roomMatrix, calibration);

		console.log('\nRobot pose:', lastPose ?? 'not found');
		console.log('Calibration:', calibration ?? 'could not determine — insufficient trace points or no grid match');
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
