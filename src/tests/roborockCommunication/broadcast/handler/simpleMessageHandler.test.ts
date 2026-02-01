import { NotifyMessageTypes } from '../../../../types/notifyMessageTypes.js';
import { describe, it, expect, vi } from 'vitest';
import { VacuumErrorCode } from '../../../../roborockCommunication/enums/index.js';
import { SimpleMessageHandler } from '../../../../roborockCommunication/routing/handlers/implementation/simpleMessageHandler.js';
import { ResponseMessage } from '../../../../roborockCommunication/models/responseMessage.js';
import { HeaderMessage } from '../../../../roborockCommunication/models/headerMessage.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';

describe('SimpleMessageHandler', () => {
  const duid = 'test-duid';

  it('calls deviceNotify on error', async () => {
    const deviceNotify = vi.fn();
    const handler = new SimpleMessageHandler(duid, deviceNotify);
    await handler.onError(VacuumErrorCode.ClearWaterTankEmpty);
    expect(deviceNotify).toHaveBeenCalledWith(NotifyMessageTypes.ErrorOccurred, expect.objectContaining({ duid, errorCode: VacuumErrorCode.ClearWaterTankEmpty }));
  });

  it('calls deviceNotify on battery update', async () => {
    const deviceNotify = vi.fn();
    const handler = new SimpleMessageHandler(duid, deviceNotify);
    await handler.onBatteryUpdate(77);
    expect(deviceNotify).toHaveBeenCalledWith(NotifyMessageTypes.BatteryUpdate, expect.objectContaining({ duid, percentage: 77 }));
  });

  it('does nothing if deviceNotify is undefined', async () => {
    const handler = new SimpleMessageHandler(duid, undefined);
    await expect(handler.onError(VacuumErrorCode.ClearWaterTankEmpty)).resolves.toBeUndefined();
    await expect(handler.onBatteryUpdate(50)).resolves.toBeUndefined();
  });

  it('onStatusChanged and onAdditionalProps do not throw', async () => {
    const handler = new SimpleMessageHandler(duid, vi.fn());
    await expect(handler.onStatusChanged(new ResponseMessage(duid, new HeaderMessage('A01', 0, 0, 0, Protocol.general_response)))).resolves.toBeUndefined();
    await expect(handler.onAdditionalProps(123)).resolves.toBeUndefined();
  });
});
