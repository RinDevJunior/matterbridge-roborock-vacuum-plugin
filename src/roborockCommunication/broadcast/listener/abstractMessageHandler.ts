import { ResponseMessage, VacuumErrorCode } from '../../index.js';

/*
  Skeleton only, implementation is no needed
*/
export interface AbstractMessageHandler {
  onError(error: VacuumErrorCode): Promise<void>;
  onBatteryUpdate(percentage: number): Promise<void>;
  onStatusChanged(message: ResponseMessage): Promise<void>;
  onAdditionalProps(value: number): Promise<void>;
}
