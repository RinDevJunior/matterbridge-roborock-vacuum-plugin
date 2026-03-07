import { AnsiLogger } from 'matterbridge/logger';

import { DeviceOTAData } from '../../../models/deviceOTAData.js';
import { Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class DeviceStatusListener implements AbstractMessageListener {
	readonly name = 'DeviceStatusListener';

	constructor(
		public readonly duid: string,
		private readonly logger: AnsiLogger,
	) {}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (!message.isForProtocol(Protocol.device_status_ota)) {
			return;
		}

		const raw = message.get(Protocol.device_status_ota);
		if (raw === null || raw === undefined || typeof raw !== 'object') {
			return;
		}

		const parsedData = raw as DeviceOTAData;

		if (parsedData.mqttOtaData) {
			const status = parsedData.mqttOtaData.mqttOtaStatus?.status;
			const progress = parsedData.mqttOtaData.mqttOtaProgress?.progress;

			if (status) {
				this.logger.info(`[${this.duid}] Firmware Update Status: ${status}`);
			}
			if (progress !== undefined) {
				this.logger.info(`[${this.duid}] Firmware Update Progress: ${progress}%`);
			}
		} else if (parsedData.online === false) {
			this.logger.info(`[${this.duid}] Device OFFLINE`);
		} else if (parsedData.online === true) {
			this.logger.info(`[${this.duid}] Device ONLINE`);
		}
	}
}
