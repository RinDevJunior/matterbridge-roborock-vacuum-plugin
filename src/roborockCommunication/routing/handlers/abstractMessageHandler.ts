import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { ServiceAreaUpdateMessage } from '../../../types/index.js';
import { OperationStatusCode } from '../../enums/index.js';
import { BatteryMessage, VacuumError } from '../../models/index.js';

/*
  Skeleton only, implementation is no needed
*/
export interface AbstractMessageHandler {
	onError(error: VacuumError): Promise<void>;
	onBatteryUpdate(message: BatteryMessage): Promise<void>;

	onStatusChanged(message: {
		status: OperationStatusCode;
		duid: string;
		inCleaning: boolean | undefined;
		inReturning: boolean | undefined;
		inFreshState: boolean | undefined;
		isLocating: boolean | undefined;
		isExploring: boolean | undefined;
		inWarmup: boolean | undefined;
	}): Promise<void>;

	onCleanModeUpdate(message: CleanModeSetting): Promise<void>;

	onServiceAreaUpdate(message: ServiceAreaUpdateMessage): Promise<void>;

	onAdditionalProps(value: number): Promise<void>;
	onActiveMapChanged(mapId: number): Promise<void>;
}
