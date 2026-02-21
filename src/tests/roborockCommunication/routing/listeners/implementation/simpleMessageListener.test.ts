import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleMessageListener } from '../../../../../roborockCommunication/routing/listeners/implementation/simpleMessageListener.js';
import { ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { AbstractMessageHandler } from '../../../../../roborockCommunication/routing/handlers/abstractMessageHandler.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';
import { AnsiLogger } from 'matterbridge/logger';
import {
  DockErrorCode,
  OperationStatusCode,
  VacuumErrorCode,
} from '../../../../../roborockCommunication/enums/index.js';

function createMockHandler(): AbstractMessageHandler {
  return asPartial<AbstractMessageHandler>({
    onBatteryUpdate: vi.fn(),
    onStatusChanged: vi.fn(),
    onCleanModeUpdate: vi.fn(),
    onServiceAreaUpdate: vi.fn(),
    onError: vi.fn(),
    onAdditionalProps: vi.fn(),
  });
}

function makeRpcResponseMessage(duid: string, resultBody: Record<string, unknown>) {
  return asPartial<ResponseMessage>({
    duid,
    isForProtocols: vi.fn().mockReturnValue(true),
    isSimpleOkResponse: vi.fn().mockReturnValue(false),
    get: vi.fn().mockReturnValue({ result: [resultBody] }),
  });
}

const baseResultBody: Record<string, unknown> = {
  state: OperationStatusCode.Idle,
  battery: 80,
  charge_status: 8,
  error_code: VacuumErrorCode.None,
  dock_error_status: DockErrorCode.None,
  in_cleaning: 0,
  in_returning: 0,
  in_fresh_state: 0,
  is_locating: 0,
  is_exploring: 0,
  in_warmup: 0,
  fan_power: 102,
  water_box_mode: 203,
  distance_off: 25,
  mop_mode: 300,
  seq_type: 0,
};

describe('SimpleMessageListener', () => {
  let logger: AnsiLogger;
  let listener: SimpleMessageListener;
  let handler: AbstractMessageHandler;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();
    listener = new SimpleMessageListener(duid, logger);
    handler = createMockHandler();
  });

  describe('constructor', () => {
    it('should set name and duid correctly', () => {
      expect(listener.name).toBe('SimpleMessageListener');
      expect(listener.duid).toBe(duid);
    });
  });

  describe('registerHandler', () => {
    it('should register a handler and allow message processing', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, baseResultBody);
      listener.onMessage(message);
      expect(handler.onBatteryUpdate).toHaveBeenCalled();
    });
  });

  describe('onMessage - early returns', () => {
    it('should log debug and return early when DUID does not match', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid: 'different-duid',
        isForProtocols: vi.fn(),
        isSimpleOkResponse: vi.fn(),
        get: vi.fn(),
      });
      listener.onMessage(message);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('does not match'));
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should log error and return early when no handler is registered', () => {
      const message = makeRpcResponseMessage(duid, baseResultBody);
      listener.onMessage(message);
      expect(logger.error).toHaveBeenCalledWith('[SimpleMessageListener]: No handler registered');
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should log debug and return early when message is not for correct protocols', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(false),
        isSimpleOkResponse: vi.fn(),
        get: vi.fn(),
      });
      listener.onMessage(message);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('not for general_request or rpc_response'));
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should log debug and return early for simple OK response', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(true),
        isSimpleOkResponse: vi.fn().mockReturnValue(true),
        get: vi.fn(),
      });
      listener.onMessage(message);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Ignoring simple 'ok' response"));
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should log debug and return early when no rpc_response data', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(true),
        isSimpleOkResponse: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue(null),
      });
      listener.onMessage(message);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('No rpc_response data'));
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should return early when result array is empty', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(true),
        isSimpleOkResponse: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue({ result: [] }),
      });
      listener.onMessage(message);
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should return early when result is not an array', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(true),
        isSimpleOkResponse: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue({ result: 'not-an-array' }),
      });
      listener.onMessage(message);
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });

    it('should log debug and return early when message does not contain state', () => {
      listener.registerHandler(handler);
      const message = asPartial<ResponseMessage>({
        duid,
        isForProtocols: vi.fn().mockReturnValue(true),
        isSimpleOkResponse: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue({ result: [{ battery: 80 }] }),
      });
      listener.onMessage(message);
      expect(logger.debug).toHaveBeenCalledWith('[SimpleMessageListener]: Message does not contain state');
      expect(handler.onBatteryUpdate).not.toHaveBeenCalled();
    });
  });

  describe('onMessage - successful processing', () => {
    it('should call all handlers when message is valid and no errors', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, baseResultBody);
      listener.onMessage(message);
      expect(handler.onBatteryUpdate).toHaveBeenCalled();
      expect(handler.onStatusChanged).toHaveBeenCalled();
      expect(handler.onCleanModeUpdate).toHaveBeenCalled();
      expect(handler.onServiceAreaUpdate).toHaveBeenCalled();
      expect(handler.onError).not.toHaveBeenCalled();
    });

    it('should call onError when vacuum error code is non-zero', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, {
        ...baseResultBody,
        error_code: VacuumErrorCode.LidarBlocked,
      });
      listener.onMessage(message);
      expect(handler.onError).toHaveBeenCalled();
      expect(handler.onBatteryUpdate).toHaveBeenCalled();
    });

    it('should call onError when dock error code is non-zero', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, {
        ...baseResultBody,
        dock_error_status: DockErrorCode.WaterEmpty,
      });
      listener.onMessage(message);
      expect(handler.onError).toHaveBeenCalled();
    });

    it('should process message with cleaning_info', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, {
        ...baseResultBody,
        state: OperationStatusCode.Cleaning,
        cleaning_info: { fan_power: 102, water_box_status: 203, mop_mode: 300, segment_id: 4 },
      });
      listener.onMessage(message);
      expect(handler.onBatteryUpdate).toHaveBeenCalled();
      expect(handler.onServiceAreaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          duid,
          state: OperationStatusCode.Cleaning,
        }),
      );
    });

    it('should process boolean flags from in_cleaning, in_returning, etc.', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, {
        ...baseResultBody,
        state: OperationStatusCode.Cleaning,
        in_cleaning: 1,
        in_returning: 0,
        in_fresh_state: 1,
        is_locating: 0,
        is_exploring: 1,
        in_warmup: 0,
      });
      listener.onMessage(message);
      expect(handler.onStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          inCleaning: true,
          inReturning: false,
          inFreshState: true,
          isLocating: false,
          isExploring: true,
          inWarmup: false,
        }),
      );
    });

    it('should use cleaning_info fan_power when present', () => {
      listener.registerHandler(handler);
      const message = makeRpcResponseMessage(duid, {
        ...baseResultBody,
        fan_power: 102,
        cleaning_info: { fan_power: 200, water_box_status: 250, mop_mode: 300 },
      });
      listener.onMessage(message);
      expect(handler.onCleanModeUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ suctionPower: 200, waterFlow: 250 }),
      );
    });
  });
});
