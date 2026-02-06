import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { BatteryMessage, DeviceStatus, DpsPayload, Protocol, ResponseMessage, StatusChangeMessage, VacuumError } from '../../../models/index.js';
import { AbstractMessageHandler } from '../../handlers/abstractMessageHandler.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { AnsiLogger } from 'matterbridge/logger';

export class SimpleMessageListener implements AbstractMessageListener {
  readonly name = 'SimpleMessageListener';

  private handler: AbstractMessageHandler | undefined;
  constructor(
    public readonly duid: string,
    private readonly logger: AnsiLogger,
  ) {}

  public registerHandler(handler: AbstractMessageHandler): void {
    this.handler = handler;
  }

  public onMessage(message: ResponseMessage): void {
    if (message.duid !== this.duid) {
      this.logger.debug(`[SimpleMessageListener]: Message DUID ${message.duid} does not match listener DUID ${this.duid}`);
      return;
    }

    if (!this.handler || !message.isForProtocol(Protocol.rpc_response)) {
      this.logger.debug(`[SimpleMessageListener]: No handler registered or message not for rpc_response`);
      return;
    }

    const rpcData = message.get(Protocol.rpc_response) as DpsPayload;

    if (!rpcData || !rpcData.result || !Array.isArray(rpcData.result) || rpcData.result.length === 0) {
      this.logger.debug(`[SimpleMessageListener]: No rpc_response data found in message`);
      return;
    }

    const deviceStatus = new DeviceStatus(message.duid, rpcData.result[0]);
    const vacuumErrorCode = deviceStatus.getVacuumErrorCode();
    const dockErrorCode = deviceStatus.getDockErrorCode();
    const battery = deviceStatus.getBattery();
    const chargeStatus = deviceStatus.getChargeStatus();
    const messageBody = deviceStatus.getMessage();
    const cleaningInfo = messageBody.cleaning_info;

    const state = messageBody.state;
    const cleanMode = new CleanModeSetting(
      cleaningInfo?.fan_power ?? messageBody.fan_power,
      cleaningInfo?.water_box_status ?? messageBody.water_box_mode,
      messageBody.distance_off,
      cleaningInfo?.mop_mode ?? messageBody.mop_mode,
    );

    const batteryMessage = new BatteryMessage(message.duid, battery, chargeStatus, state);

    if ((vacuumErrorCode !== undefined && vacuumErrorCode !== 0) || (dockErrorCode !== undefined && dockErrorCode !== 0)) {
      this.logger.debug(`[SimpleMessageListener]: Detected error code ${vacuumErrorCode} or dock error code ${dockErrorCode}`);
      this.handler.onError(new VacuumError(message.duid, vacuumErrorCode, dockErrorCode));
    }

    const statusChangeMessage = new StatusChangeMessage(
      message.duid,
      state,
      messageBody.in_cleaning !== undefined ? Boolean(messageBody.in_cleaning) : undefined,
      messageBody.in_returning !== undefined ? Boolean(messageBody.in_returning) : undefined,
      messageBody.in_fresh_state !== undefined ? Boolean(messageBody.in_fresh_state) : undefined,
      messageBody.is_locating !== undefined ? Boolean(messageBody.is_locating) : undefined,
      messageBody.is_exploring !== undefined ? Boolean(messageBody.is_exploring) : undefined,
      messageBody.in_warmup !== undefined ? Boolean(messageBody.in_warmup) : undefined,
    );

    this.handler.onBatteryUpdate(batteryMessage);
    this.handler.onStatusChanged(statusChangeMessage);
    this.handler.onCleanModeUpdate(cleanMode);
  }
}
