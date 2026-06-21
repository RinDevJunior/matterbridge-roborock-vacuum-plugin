import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { NetworkInfo, RequestMessage } from '../../models/index.js';

export interface AbstractMessageDispatcher {
	dispatcherName: string;

	getNetworkInfo(duid: string): Promise<NetworkInfo | undefined>;
	getDeviceStatus(duid: string): Promise<void>;
	goHome(duid: string): Promise<void>;
	startCleaning(duid: string): Promise<void>;
	startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void>;
	pauseCleaning(duid: string): Promise<void>;
	resumeCleaning(duid: string): Promise<void>;
	resumeRoomCleaning(duid: string): Promise<void>;
	stopCleaning(duid: string): Promise<void>;
	findMyRobot(duid: string): Promise<void>;

	// For custom messages
	sendCustomMessage(duid: string, def: RequestMessage): Promise<void>;
	getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T>;

	getCleanModeData(duid: string): Promise<CleanModeSetting>;
	changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void>;

	// For core data retrieval
	getMapInfo(duid: string): Promise<void>;
	getRoomMap(duid: string, activeMap: number): Promise<void>;
	getSerialNumber(duid: string): Promise<string | undefined>;
}
