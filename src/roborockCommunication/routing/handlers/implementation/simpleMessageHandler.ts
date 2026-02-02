import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { DeviceNotifyCallback, NotifyMessageTypes } from '../../../../types/index.js';
import { OperationStatusCode } from '../../../enums/index.js';
import { BatteryMessage, VacuumError } from '../../../models/index.js';
import { AbstractMessageHandler } from '../abstractMessageHandler.js';

export class SimpleMessageHandler implements AbstractMessageHandler {
  private readonly deviceNotify: DeviceNotifyCallback | undefined;

  constructor(
    private readonly duid: string,
    deviceNotify: DeviceNotifyCallback | undefined,
  ) {
    this.deviceNotify = deviceNotify;
  }

  public onError(error: VacuumError): void {
    this.deviceNotify?.({
      type: NotifyMessageTypes.ErrorOccurred,
      data: {
        duid: error.duid,
        errorCode: error.vacuumErrorCode,
      },
    });
  }

  public onBatteryUpdate(message: BatteryMessage): void {
    this.deviceNotify?.({
      type: NotifyMessageTypes.BatteryUpdate,
      data: {
        ...message,
      },
    });
  }

  public onStatusChanged(message: { status: OperationStatusCode; duid: string }): void {
    this.deviceNotify?.({
      type: NotifyMessageTypes.DeviceStatus,
      data: {
        duid: message.duid,
        status: message.status,
      },
    });
  }

  public onCleanModeUpdate(message: CleanModeSetting): void {
    this.deviceNotify?.({
      type: NotifyMessageTypes.CleanModeUpdate,
      data: {
        ...message,
        duid: this.duid,
      },
    });
  }

  public onAdditionalProps(value: number): void {
    // Implement additional properties handling logic here
  }
}
