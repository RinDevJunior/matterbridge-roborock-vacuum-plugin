import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { OperationStatusCode } from '../../enums/index.js';
import { BatteryMessage, VacuumError } from '../../models/index.js';

/*
  Skeleton only, implementation is no needed
*/
export interface AbstractMessageHandler {
  onError(error: VacuumError): void;
  onBatteryUpdate(message: BatteryMessage): void;
  onStatusChanged(message: { status: OperationStatusCode; duid: string }): void;
  onCleanModeUpdate(message: CleanModeSetting): void;
  onAdditionalProps(value: number): void;
}
