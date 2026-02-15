import { AnsiLogger } from 'matterbridge/logger';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { DeviceNotifyCallback, NotifyMessageTypes, ServiceAreaUpdateMessage } from '../../../../types/index.js';
import { BatteryMessage, StatusChangeMessage, VacuumError } from '../../../models/index.js';
import { AbstractMessageHandler } from '../abstractMessageHandler.js';

export class SimpleMessageHandler implements AbstractMessageHandler {
  constructor(
    private readonly duid: string,
    private readonly logger: AnsiLogger,
    private readonly deviceNotify: DeviceNotifyCallback | undefined,
  ) {}

  public onError(error: VacuumError): void {
    if (!this.deviceNotify) {
      this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
      return;
    }

    this.deviceNotify({
      type: NotifyMessageTypes.ErrorOccurred,
      data: {
        duid: error.duid,
        vacuumErrorCode: error.vacuumErrorCode,
        dockErrorCode: error.dockErrorCode,
        dockStationStatus: error.dockStationStatus,
      },
    });
  }

  public onBatteryUpdate(message: BatteryMessage): void {
    if (!this.deviceNotify) {
      this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
      return;
    }

    this.deviceNotify({
      type: NotifyMessageTypes.BatteryUpdate,
      data: message,
    });
  }

  public onStatusChanged(message: StatusChangeMessage): void {
    if (!this.deviceNotify) {
      this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
      return;
    }

    this.deviceNotify({
      type: NotifyMessageTypes.DeviceStatus,
      data: message,
    });
  }

  public onCleanModeUpdate(message: CleanModeSetting): void {
    if (!this.deviceNotify) {
      this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
      return;
    }

    this.deviceNotify({
      type: NotifyMessageTypes.CleanModeUpdate,
      data: {
        ...message,
        duid: this.duid,
        seq_type: message.sequenceType,
      },
    });
  }

  public onServiceAreaUpdate(message: ServiceAreaUpdateMessage): void {
    if (!this.deviceNotify) {
      this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
      return;
    }

    this.deviceNotify({
      type: NotifyMessageTypes.ServiceAreaUpdate,
      data: message,
    });
  }

  public onAdditionalProps(value: number): void {
    // Implement additional properties handling logic here
  }
}
