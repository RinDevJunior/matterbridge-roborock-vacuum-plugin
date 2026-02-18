import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResponseBroadcasterFactory } from '../../../../roborockCommunication/routing/listeners/responseBroadcasterFactory.js';
import { HeaderMessage, RequestMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { MessageContext } from '../../../../roborockCommunication/models/messageContext.js';
import { ProtocolVersion } from '../../../../roborockCommunication/enums/index.js';
import { createMockLogger, asPartial } from '../../../helpers/testUtils.js';
import { AnsiLogger } from 'matterbridge/logger';
import { AbstractMessageListener } from '../../../../roborockCommunication/routing/listeners/abstractMessageListener.js';

function makeV1Response(duid = 'v1-duid'): ResponseMessage {
  const header = new HeaderMessage('1.0', 1, 0, 101, 102);
  const body = new ResponseBody({ '102': { id: 123, result: ['ok'] } });
  return new ResponseMessage(duid, header, body);
}

function makeB01Response(duid = 'b01-duid'): ResponseMessage {
  const header = new HeaderMessage('B01', 1, 0, 101, 102);
  const body = new ResponseBody({ '101': { '108': 4 } });
  return new ResponseMessage(duid, header, body);
}

function makeRequest(timestamp = 100, protocol = 101): RequestMessage {
  return new RequestMessage({ timestamp, protocol, messageId: 1234, nonce: 5678 });
}

describe('ResponseBroadcasterFactory', () => {
  let logger: AnsiLogger;
  let context: MessageContext;
  let factory: ResponseBroadcasterFactory;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createMockLogger();
    context = asPartial<MessageContext>({
      getMQTTProtocolVersion: vi.fn().mockReturnValue(ProtocolVersion.V1),
    });
    factory = new ResponseBroadcasterFactory(context, logger);
  });

  afterEach(() => {
    factory.unregister();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should have name ResponseBroadcasterFactory', () => {
    expect(factory.name).toBe('ResponseBroadcasterFactory');
  });

  it('should register listener to both V1 and B01 broadcasters', () => {
    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);

    const v1Response = makeV1Response();
    factory.onMessage(v1Response);
    expect(listener.onMessage).toHaveBeenCalledWith(v1Response);

    const b01Response = makeB01Response();
    factory.onMessage(b01Response);
    expect(listener.onMessage).toHaveBeenCalledWith(b01Response);
  });

  it('should unregister from both broadcasters', () => {
    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);
    factory.unregister();

    factory.onMessage(makeV1Response());
    factory.onMessage(makeB01Response());
    expect(listener.onMessage).not.toHaveBeenCalled();
  });

  it('should route tryResolve to V1 broadcaster for V1 responses', () => {
    const response = makeV1Response();
    expect(() => factory.tryResolve(response)).not.toThrow();
  });

  it('should route tryResolve to B01 broadcaster for B01 responses', () => {
    const response = makeB01Response();
    expect(() => factory.tryResolve(response)).not.toThrow();
  });

  it('should route onMessage to V1 broadcaster for V1 responses', () => {
    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);

    const response = makeV1Response();
    factory.onMessage(response);
    expect(listener.onMessage).toHaveBeenCalledWith(response);
  });

  it('should route onMessage to B01 broadcaster for B01 responses', () => {
    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);

    const response = makeB01Response();
    factory.onMessage(response);
    expect(listener.onMessage).toHaveBeenCalledWith(response);
  });

  it('should use context.getMQTTProtocolVersion when header version is undefined', () => {
    vi.mocked(context.getMQTTProtocolVersion).mockReturnValue(ProtocolVersion.B01);

    const header = new HeaderMessage(undefined as unknown as string, 1, 0, 101, 102);
    const body = new ResponseBody({ '101': { '108': 4 } });
    const response = new ResponseMessage('some-duid', header, body);

    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);

    factory.onMessage(response);
    expect(context.getMQTTProtocolVersion).toHaveBeenCalledWith('some-duid');
    expect(listener.onMessage).toHaveBeenCalledWith(response);
  });

  it('should route waitFor to V1 tracker for V1 devices', async () => {
    vi.mocked(context.getMQTTProtocolVersion).mockReturnValue(ProtocolVersion.V1);
    const request = makeRequest();

    const promise = factory.waitFor(request, 'v1-device');
    // V1 tracker does not reject on cancelAll; advance past timeout
    vi.advanceTimersByTime(11000);
    await expect(promise).rejects.toThrow();
  });

  it('should route waitFor to B01 tracker for B01 devices', async () => {
    const request = new RequestMessage({ timestamp: 100, protocol: 101, messageId: 1234, nonce: 5678, version: ProtocolVersion.B01 });

    const promise = factory.waitFor(request, 'b01-device');
    // B01 tracker rejects on cancelAll
    factory.cancelAll();
    await expect(promise).rejects.toThrow();
  });

  it('should cancelAll pending requests from B01 tracker', async () => {
    const request = new RequestMessage({ timestamp: 100, protocol: 101, messageId: 1234, nonce: 5678, version: ProtocolVersion.B01 });
    const promise = factory.waitFor(request, 'b01-device');

    factory.cancelAll();
    await expect(promise).rejects.toThrow();
  });

  it('should fall back to V1 broadcaster when protocol version is not B01', () => {
    vi.mocked(context.getMQTTProtocolVersion).mockReturnValue(ProtocolVersion.V1);

    const header = new HeaderMessage(undefined as unknown as string, 1, 0, 101, 102);
    const body = new ResponseBody({ '102': { id: 123, result: ['ok'] } });
    const response = new ResponseMessage('v1-duid', header, body);

    const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
    factory.register(listener);

    factory.onMessage(response);
    expect(listener.onMessage).toHaveBeenCalledWith(response);
  });

  it('should fall back to V1 tracker when protocol version is not B01', async () => {
    vi.mocked(context.getMQTTProtocolVersion).mockReturnValue(ProtocolVersion.A01);
    const request = makeRequest();

    const promise = factory.waitFor(request, 'a01-device');
    // V1 tracker does not reject on cancelAll; advance past timeout
    vi.advanceTimersByTime(11000);
    await expect(promise).rejects.toThrow();
  });
});
