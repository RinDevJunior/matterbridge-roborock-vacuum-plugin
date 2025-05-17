import { VacuumErrorCode } from '../../Zenum/vacuumAndDockErrorCode.js';

/*
  Skeleton only, implementation is no needed
*/
export interface AbstractMessageHandler {
  onError(error: VacuumErrorCode): Promise<void>;
  onBatteryUpdate(percentage: number): Promise<void>;
  onStatusChanged(): Promise<void>;
  onAdditionalProps(value: number): Promise<void>;
}
