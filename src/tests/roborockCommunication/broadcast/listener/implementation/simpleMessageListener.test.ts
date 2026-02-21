import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleMessageListener } from '../../../../../roborockCommunication/routing/listeners/implementation/simpleMessageListener.js';
import { HeaderMessage, Protocol, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';

describe('SimpleMessageListener', () => {
  let listener: SimpleMessageListener;
  let handler: any;
  let message: any;
  const logger: any = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    listener = new SimpleMessageListener('123', logger);
    handler = {
      onStatusChanged: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn().mockResolvedValue(undefined),
      onBatteryUpdate: vi.fn().mockResolvedValue(undefined),
      onAdditionalProps: vi.fn().mockResolvedValue(undefined),
      onCleanModeUpdate: vi.fn().mockResolvedValue(undefined),
      onServiceAreaUpdate: vi.fn().mockResolvedValue(undefined),
    };
    message = {
      get: vi.fn(),
      isForProtocol: vi.fn(),
      isForProtocols: vi.fn(),
      isForStatus: vi.fn(),
      isSimpleOkResponse: vi.fn().mockReturnValue(false),
      duid: '123',
      body: undefined,
      header: {} as HeaderMessage,
    };
    listener.registerHandler(handler);
  });

  it('should do nothing if no handler registered', () => {
    const l = new SimpleMessageListener('123', logger);
    expect(() => l.onMessage(message as ResponseMessage)).not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should do nothing if message is not rpc_response', () => {
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.battery).mockReturnValue(false);
    listener.onMessage(message);
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should handle rpc_response with battery and state', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({
      id: 15472,
      result: [{ battery: 100, state: 8, error_code: 0, dock_error_status: 0, dock_type: 1 }],
    });
    await listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 100 }));
    expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.anything());
    expect(handler.onError).not.toHaveBeenCalled();
  });

  it('should handle rpc_response with error_code', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({
      id: 15472,
      result: [{ battery: 50, state: 8, error_code: 5, dock_error_status: 0, dock_type: 1 }],
    });
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 50 }));
    expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.anything());
    expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ vacuumErrorCode: 5 }));
  });

  it('should handle rpc_response with empty result', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({ id: 15472, result: [] });
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
  });

  it('should handle rpc_response with no result field', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({ id: 15472 });
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
  });

  it('should do nothing if message duid does not match listener duid', async () => {
    message.duid = '456';
    message.isForProtocol.mockImplementation((proto: Protocol) => proto === Protocol.rpc_response);
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      '[SimpleMessageListener]: Message DUID 456 does not match listener DUID 123',
    );
  });

  it('should handle rpc_response with dock_error_status', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({
      id: 15472,
      result: [{ battery: 75, state: 8, error_code: 0, dock_error_status: 3, dock_type: 1 }],
    });
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 75 }));
    expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.anything());
    expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ dockErrorCode: 3 }));
  });

  it('should handle rpc_response with both vacuum and dock errors', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.get.mockReturnValue({
      id: 15472,
      result: [{ battery: 60, state: 8, error_code: 2, dock_error_status: 1, dock_type: 1 }],
    });
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).toHaveBeenCalledWith(expect.objectContaining({ percentage: 60 }));
    expect(handler.onStatusChanged).toHaveBeenCalledWith(expect.anything());
    expect(handler.onError).toHaveBeenCalledWith(expect.objectContaining({ vacuumErrorCode: 2, dockErrorCode: 1 }));
  });

  it('should ignore simple ok response', async () => {
    message.isForProtocols.mockReturnValue(true);
    message.isSimpleOkResponse = vi.fn().mockReturnValue(true);
    listener.onMessage(message);
    expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    expect(handler.onStatusChanged).not.toHaveBeenCalled();
    expect(handler.onError).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith("[SimpleMessageListener]: Ignoring simple 'ok' response");
  });
});
