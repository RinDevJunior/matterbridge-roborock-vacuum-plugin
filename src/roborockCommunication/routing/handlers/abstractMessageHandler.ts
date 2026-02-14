import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { ServiceAreaUpdateMessage } from '../../../types/index.js';
import { OperationStatusCode } from '../../enums/index.js';
import { BatteryMessage, VacuumError } from '../../models/index.js';

/*
  Skeleton only, implementation is no needed
*/
export interface AbstractMessageHandler {
  onError(error: VacuumError): void;
  onBatteryUpdate(message: BatteryMessage): void;

  onStatusChanged(message: {
    status: OperationStatusCode;
    duid: string;
    inCleaning: boolean | undefined;
    inReturning: boolean | undefined;
    inFreshState: boolean | undefined;
    isLocating: boolean | undefined;
    isExploring: boolean | undefined;
    inWarmup: boolean | undefined;
  }): void;

  onCleanModeUpdate(message: CleanModeSetting): void;

  onServiceAreaUpdate(message: ServiceAreaUpdateMessage): void;

  onAdditionalProps(value: number): void;
}
