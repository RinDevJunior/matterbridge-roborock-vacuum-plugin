import { NotifyMessageTypes } from '@/notifyMessageTypes.js';
import { DeviceNotifyCallback } from '@/types/index.js';
import { VacuumErrorCode, AbstractMessageHandler, ResponseMessage } from '../../index.js';

export class SimpleMessageHandler implements AbstractMessageHandler {
  private readonly deviceNotify: DeviceNotifyCallback | undefined;
  private readonly duid: string;

  constructor(duid: string, deviceNotify: DeviceNotifyCallback | undefined) {
    this.deviceNotify = deviceNotify;
    this.duid = duid;
  }

  public async onError(error: VacuumErrorCode): Promise<void> {
    this.deviceNotify?.(NotifyMessageTypes.ErrorOccurred, { duid: this.duid, errorCode: error });
  }

  public async onBatteryUpdate(percentage: number): Promise<void> {
    this.deviceNotify?.(NotifyMessageTypes.BatteryUpdate, { duid: this.duid, percentage });
  }

  public async onStatusChanged(message: ResponseMessage): Promise<void> {
    // Implement status change handling logic here
  }

  public async onAdditionalProps(value: number): Promise<void> {
    // Implement additional properties handling logic here
  }
}
