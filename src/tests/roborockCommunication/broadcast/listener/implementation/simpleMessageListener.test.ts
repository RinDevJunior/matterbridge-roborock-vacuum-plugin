import { SimpleMessageListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/simpleMessageListener';
import { Protocol } from '../../../../../roborockCommunication/broadcast/model/protocol';

describe('SimpleMessageListener', () => {
  let listener: SimpleMessageListener;
  let handler: any;
  let message: any;

  beforeEach(() => {
    listener = new SimpleMessageListener();
    handler = {
      onStatusChanged: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn().mockResolvedValue(undefined),
      onBatteryUpdate: jest.fn().mockResolvedValue(undefined),
      onAdditionalProps: jest.fn().mockResolvedValue(undefined),
    };
    message = {
      contain: jest.fn(),
      get: jest.fn(),
    };
    listener.registerListener(handler);
  });

  it('should do nothing if no handler registered', async () => {
    const l = new SimpleMessageListener();
    await expect(l.onMessage(message)).resolves.toBeUndefined();
  });

  it('should do nothing if message is rpc_response or map_response', async () => {
    message.contain.mockImplementation((proto: Protocol) => proto === Protocol.rpc_response || proto === Protocol.map_response);
    await listener.onMessage(message);
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onAdditionalProps).not.toHaveBeenCalled();
  });

  it('should call onStatusChanged if status_update present', async () => {
    message.contain.mockImplementation((proto: Protocol) => proto === Protocol.status_update);
    await listener.onMessage(message);
    expect(handler.onStatusChanged).toHaveBeenCalled();
  });

  it('should call onError if error present', async () => {
    message.contain.mockImplementation((proto: Protocol) => proto === Protocol.error);
    message.get.mockReturnValue('42');
    await listener.onMessage(message);
    expect(handler.onError).toHaveBeenCalledWith(42);
  });

  it('should call onBatteryUpdate if battery present', async () => {
    message.contain.mockImplementation((proto: Protocol) => proto === Protocol.battery);
    message.get.mockReturnValue('77');
    await listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(77);
  });

  it('should call onAdditionalProps if additional_props present', async () => {
    message.contain.mockImplementation((proto: Protocol) => proto === Protocol.additional_props);
    message.get.mockReturnValue('99');
    await listener.onMessage(message);
    expect(handler.onAdditionalProps).toHaveBeenCalledWith(99);
  });

  it('should not call handler methods if they are undefined', async () => {
    const handlerPartial = {};
    listener.registerListener(handlerPartial as any);
    message.contain.mockReturnValue(true);
    await expect(listener.onMessage(message)).resolves.toBeUndefined();
  });
});
