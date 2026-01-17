import { AbstractMessageHandler, ResponseMessage } from '../../../../../roborockCommunication';
import { SimpleMessageListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/simpleMessageListener';
import { HeaderMessage } from '../../../../../roborockCommunication/broadcast/model/headerMessage';
import { Protocol } from '../../../../../roborockCommunication/broadcast/model/protocol';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SimpleMessageListener', () => {
  let listener: SimpleMessageListener;
  let handler: any;
  let message: any;

  beforeEach(() => {
    listener = new SimpleMessageListener();
    handler = {
      onStatusChanged: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn().mockResolvedValue(undefined),
      onBatteryUpdate: vi.fn().mockResolvedValue(undefined),
      onAdditionalProps: vi.fn().mockResolvedValue(undefined),
    };
    message = {
      get: vi.fn(),
      isForProtocol: vi.fn(),
      isForProtocols: vi.fn(),
      isForStatus: vi.fn(),
      duid: '',
      body: undefined,
      header: {} as HeaderMessage,
    };
    listener.registerListener(handler);
  });

  it('should do nothing if no handler registered', async () => {
    const l = new SimpleMessageListener();
    await expect(l.onMessage(message as ResponseMessage)).resolves.toBeUndefined();
  });

  it('should do nothing if message is rpc_response or map_response', async () => {
    message.isForProtocols.mockImplementation((protos: Protocol[]) => protos.includes(Protocol.rpc_response) || protos.includes(Protocol.map_response)).mockReturnValue(true);
    await listener.onMessage(message);
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onAdditionalProps).not.toHaveBeenCalled();
  });

  it('should call onStatusChanged if status_update present', async () => {
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.status_update).mockReturnValue(true);
    await listener.onMessage(message);
    expect(handler.onStatusChanged).toHaveBeenCalled();
  });

  it('should call onError if error present', async () => {
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.error).mockReturnValue(true);
    message.get.mockReturnValue('42');
    await listener.onMessage(message);
    expect(handler.onError).toHaveBeenCalledWith(42);
  });

  it('should call onBatteryUpdate if battery present', async () => {
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.battery).mockReturnValue(true);
    message.get.mockReturnValue('77');
    await listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(77);
  });

  it('should call onAdditionalProps if additional_props present', async () => {
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.additional_props).mockReturnValue(true);
    message.get.mockReturnValue('99');
    await listener.onMessage(message);
    expect(handler.onAdditionalProps).toHaveBeenCalledWith(99);
  });

  it('should not call handler methods if they are undefined', async () => {
    const handlerPartial = {} as AbstractMessageHandler;
    listener.registerListener(handlerPartial);
    message.isForProtocol.mockReturnValue(true);
    await expect(listener.onMessage(message)).resolves.toBeUndefined();
  });
});
