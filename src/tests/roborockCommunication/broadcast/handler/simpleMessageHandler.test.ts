import { NotifyMessageTypes } from '../../../../types/notifyMessageTypes.js';
import { describe, it, expect, vi } from 'vitest';
import { DockErrorCode, OperationStatusCode, VacuumErrorCode } from '../../../../roborockCommunication/enums/index.js';
import { SimpleMessageHandler } from '../../../../roborockCommunication/routing/handlers/implementation/simpleMessageHandler.js';
import { BatteryMessage, DeviceStatus, VacuumError } from '../../../../roborockCommunication/models/index.js';
import { createMockLogger } from '../../../testUtils.js';

describe('SimpleMessageHandler', () => {
  const duid = 'test-duid';
  const logger = createMockLogger();

  it('calls deviceNotify on error', () => {
    const deviceNotify = vi.fn();
    const handler = new SimpleMessageHandler(duid, logger, deviceNotify);
    const error = new VacuumError(duid, VacuumErrorCode.ClearWaterTankEmpty, DockErrorCode.None);
    handler.onError(error);
    expect(deviceNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotifyMessageTypes.ErrorOccurred,
        data: expect.objectContaining({ duid, errorCode: VacuumErrorCode.ClearWaterTankEmpty }),
      }),
    );
  });

  it('calls deviceNotify on battery update', () => {
    const deviceNotify = vi.fn();
    const handler = new SimpleMessageHandler(duid, logger, deviceNotify);
    const batteryMessage = new BatteryMessage(duid, 77, 8, OperationStatusCode.Charging);
    handler.onBatteryUpdate(batteryMessage);
    expect(deviceNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotifyMessageTypes.BatteryUpdate,
        data: expect.objectContaining({ duid, percentage: 77, deviceStatus: 8, chargeStatus: OperationStatusCode.Charging }),
      }),
    );
  });

  it('calls deviceNotify on status changed', () => {
    const deviceNotify = vi.fn();
    const handler = new SimpleMessageHandler(duid, logger, deviceNotify);
    const message = {
      msg_ver: 1,
      msg_seq: 1,
      state: 0,
      battery: 80,
      clean_time: 0,
      clean_area: 0,
      error_code: VacuumErrorCode.None,
      map_present: 0,
      in_cleaning: 0,
      in_returning: 0,
      in_fresh_state: 0,
      lab_status: 0,
      water_box_status: 0,
      fan_power: 0,
      dnd_enabled: 0,
      map_status: 0,
      is_locating: 0,
      lock_status: 0,
      water_box_mode: 0,
      distance_off: 0,
      water_box_carriage_status: 0,
      mop_forbidden_enable: 0,
      adbumper_status: [],
      dock_type: 1,
      dust_collection_status: 0,
      auto_dust_collection: 0,
      debug_mode: 0,
      switch_map_mode: 0,
      dock_error_status: DockErrorCode.None,
      charge_status: 0,
    };
    handler.onStatusChanged({
      duid,
      status: message.state,
      inCleaning: Boolean(message.in_cleaning),
      inReturning: Boolean(message.in_returning),
      inFreshState: Boolean(message.in_fresh_state),
      isLocating: Boolean(message.is_locating),
      isExploring: Boolean(undefined),
      inWarmup: Boolean(undefined),
    });
    expect(deviceNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotifyMessageTypes.DeviceStatus,
        data: {
          duid,
          status: message.state,
          inCleaning: false,
          inReturning: false,
          inFreshState: false,
          isLocating: false,
          isExploring: false,
          inWarmup: false,
        },
      }),
    );
  });

  it('does nothing if deviceNotify is undefined', () => {
    const handler = new SimpleMessageHandler(duid, logger, undefined);
    const error = new VacuumError(duid, VacuumErrorCode.ClearWaterTankEmpty, DockErrorCode.None);
    const batteryMessage = new BatteryMessage(duid, 50, undefined, undefined);
    expect(() => handler.onError(error)).not.toThrow();
    expect(() => handler.onBatteryUpdate(batteryMessage)).not.toThrow();
  });

  it('onAdditionalProps does not throw', () => {
    const handler = new SimpleMessageHandler(duid, logger, vi.fn());
    expect(() => handler.onAdditionalProps(123)).not.toThrow();
  });
});
