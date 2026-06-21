import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { Q10RequestCode, Q10RequestMethod } from '../../enums/Q10RequestCode.js';
import { B01VacuumModeResolver } from '../../helper/B01VacuumModeResolver.js';
import { NetworkInfo } from '../../models/index.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { Client } from '../../routing/client.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';

export class Q10MessageDispatcher implements AbstractMessageDispatcher {
	public dispatcherName = 'Q10MessageDispatcher';
	private lastB01Id: number;

	private get messageId() {
		let tmpMessageId = Math.floor(Date.now() / 1000);
		if (tmpMessageId <= this.lastB01Id) {
			tmpMessageId = this.lastB01Id + 1;
		}
		this.lastB01Id = tmpMessageId;

		return this.lastB01Id;
	}

	constructor(
		private readonly logger: AnsiLogger,
		private readonly client: Client,
	) {
		this.lastB01Id = Math.floor(Date.now() / 1000);
	}

	public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
		await this.client.send(duid, request);
		return undefined;
	}

	public async getSerialNumber(duid: string): Promise<string | undefined> {
		return duid;
	}

	public async getDeviceStatus(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
		await this.client.send(duid, request);
	}

	// #region Core Data Retrieval
	public async getMapInfo(duid: string): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: { [Q10RequestCode.common_request]: { [Q10RequestMethod.multimap]: { 'op': 'list' } } },
		});
		await this.client.send(duid, request);
	}

	public async getRoomMap(duid: string, _activeMap: number): Promise<void> {
		await this.client.send(
			duid,
			new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.get_prop]: 1 } }),
		);
	}
	// #endregion Core Data Retrieval

	// #region Cleaning Commands
	public async goHome(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.app_charge]: 0 } });
		await this.client.send(duid, request);
	}

	public async startCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: { [Q10RequestCode.app_start]: { 'cmd': 1 } },
		});
		await this.client.send(duid, request);
	}

	public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: { [Q10RequestCode.app_start]: { 'cmd': 2, 'clean_paramters': roomIds } },
		});
		await this.client.send(duid, request);
	}

	public async pauseCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.app_pause]: 0 } });
		await this.client.send(duid, request);
	}

	public async resumeCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.app_resume]: 0 } });
		await this.client.send(duid, request);
	}

	public async resumeRoomCleaning(duid: string): Promise<void> {
		await this.resumeCleaning(duid);
	}

	public async stopCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.app_stop]: 0 } });
		await this.client.send(duid, request);
	}

	public async findMyRobot(duid: string): Promise<void> {
		// TODO: Verify the command for Q10
		const request = new RequestMessage({ messageId: this.messageId, method: 'find_me' });
		await this.client.send(duid, request);
	}

	public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
		const request = new RequestMessage({ ...def, messageId: this.messageId });
		return this.client.send(duid, request);
	}

	public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
		const request = new RequestMessage({ ...def, messageId: this.messageId });
		const result = await this.client.query<T>(duid, request, (msg) => {
			if (!msg.body) return undefined;
			const data = msg.body.data;
			if (!data) return undefined;
			const values = Object.values(data);
			return values.length > 0 ? (values[0] as T) : undefined;
		});
		return result as T;
	}

	public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
		return new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist); // TODO: Implement retrieval of clean mode data for Q10
	}

	public async changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void> {
		const { suctionPower, waterFlow, distance_off, mopRoute } = setting;
		this.logger?.notice(
			`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`,
		);
		await this.setCleanMode(duid, suctionPower, waterFlow);
		if (suctionPower !== 0) {
			await this.setVacuumMode(duid, suctionPower);
		}
		if (waterFlow !== 0) {
			await this.setWaterMode(duid, waterFlow);
		}
	}
	// #endregion Cleaning Commands

	// #region Private Helpers
	private async setCleanMode(duid: string, suctionPower: number, waterFlow: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: {
				[Q10RequestMethod.change_clean_mode]: B01VacuumModeResolver.resolveQ10CleanMode(suctionPower, waterFlow),
			},
		});
		return this.client.send(duid, request);
	}

	private async setVacuumMode(duid: string, mode: number) {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: {
				[Q10RequestMethod.change_vacuum_mode]: B01VacuumModeResolver.resolveVacuumMode(mode),
			},
		});
		return this.client.send(duid, request);
	}

	private async setWaterMode(duid: string, mode: number) {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: {
				[Q10RequestMethod.change_mop_mode]: B01VacuumModeResolver.resolveMopMode(mode),
			},
		});
		return this.client.send(duid, request);
	}
	// #endregion Private Helpers
}
