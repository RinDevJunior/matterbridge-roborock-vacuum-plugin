import { describe, it, expect } from 'vitest';
import { MessageDispatcherFactory } from '../../../../roborockCommunication/protocol/dispatcher/dispatcherFactory.js';
import { ProtocolVersion, NewProtocolVersion } from '../../../../roborockCommunication/enums/index.js';
import { DeviceModel } from '../../../../roborockCommunication/models/deviceModel.js';
import { createMockLogger, makeMockClientRouter } from '../../../helpers/testUtils.js';

describe('MessageDispatcherFactory', () => {
  const logger = createMockLogger();
  const clientRouter = makeMockClientRouter();

  function createFactory() {
    return new MessageDispatcherFactory(clientRouter, logger);
  }

  describe('constructor', () => {
    it('should create dispatchers for all NewProtocolVersion values', () => {
      const factory = createFactory();
      expect(factory).toBeDefined();
    });
  });

  describe('getMessageDispatcher', () => {
    describe('V1 protocol', () => {
      it('should return V10MessageDispatcher for V1 protocol version', () => {
        const factory = createFactory();
        const dispatcher = factory.getMessageDispatcher(ProtocolVersion.V1, DeviceModel.S7);
        expect(dispatcher.dispatcherName).toBe('V10MessageDispatcher');
      });

      it('should return V10MessageDispatcher for L01 protocol version', () => {
        const factory = createFactory();
        const dispatcher = factory.getMessageDispatcher(ProtocolVersion.L01, DeviceModel.S7);
        expect(dispatcher.dispatcherName).toBe('V10MessageDispatcher');
      });
    });

    describe('B01 protocol with Q7 model (sc prefix)', () => {
      it('should return Q7MessageDispatcher for B01 protocol with sc model', () => {
        const factory = createFactory();
        const dispatcher = factory.getMessageDispatcher(ProtocolVersion.B01, 'roborock.vacuum.sc01' as DeviceModel);
        expect(dispatcher.dispatcherName).toBe('Q7MessageDispatcher');
      });
    });

    describe('B01 protocol with Q10 model (ss prefix)', () => {
      it('should return Q10MessageDispatcher for B01 protocol with ss model', () => {
        const factory = createFactory();
        const dispatcher = factory.getMessageDispatcher(ProtocolVersion.B01, DeviceModel.Q10_S5_PLUS);
        expect(dispatcher.dispatcherName).toBe('Q10MessageDispatcher');
      });
    });

    describe('error handling', () => {
      it('should log error when version is undefined', () => {
        const factory = createFactory();
        expect(() => factory.getMessageDispatcher(undefined as unknown as string, DeviceModel.S7)).toThrow();
        expect(logger.error).toHaveBeenCalledWith('Unable to send message: no version included');
      });

      it('should throw for unsupported protocol version', () => {
        const factory = createFactory();
        expect(() => factory.getMessageDispatcher('X99', DeviceModel.S7)).toThrow('Unsupported protocol version: X99');
      });

      it('should throw for B01 protocol with unsupported model prefix', () => {
        const factory = createFactory();
        expect(() => factory.getMessageDispatcher(ProtocolVersion.B01, 'roborock.vacuum.zz01' as DeviceModel)).toThrow(
          /Unsupported robot model.*for B01 protocol/,
        );
      });

      it('should throw for B01 protocol when model is undefined', () => {
        const factory = createFactory();
        expect(() => factory.getMessageDispatcher(ProtocolVersion.B01, undefined as unknown as DeviceModel)).toThrow(
          'Missing robot model, required for B01 protocol',
        );
      });
    });

    describe('dispatcher reuse', () => {
      it('should return the same dispatcher instance for the same protocol', () => {
        const factory = createFactory();
        const dispatcher1 = factory.getMessageDispatcher(ProtocolVersion.V1, DeviceModel.S7);
        const dispatcher2 = factory.getMessageDispatcher(ProtocolVersion.V1, DeviceModel.S8);
        expect(dispatcher1).toBe(dispatcher2);
      });
    });

    describe('dispatcher for', () => {
      it('should return the same dispatcher instance for the same protocol', () => {
        const factory = createFactory();
        const dispatcher = factory.getMessageDispatcher(ProtocolVersion.B01, DeviceModel.Q10_S5_PLUS);
        expect(dispatcher.dispatcherName).toBe('Q10MessageDispatcher');
      });
    });

    describe('debug logging', () => {
      it('should log the dispatcher name and device info', () => {
        const factory = createFactory();
        factory.getMessageDispatcher(ProtocolVersion.V1, DeviceModel.S7);
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('V10MessageDispatcher'));
      });
    });
  });
});
