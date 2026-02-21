import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbstractClient } from '../../../roborockCommunication/routing/abstractClient.js';
import {
  MessageContext,
  RequestMessage,
  UserData,
  ResponseMessage,
} from '../../../roborockCommunication/models/index.js';
import { V1PendingResponseTracker } from '../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { createMockLogger, asPartial, asType, mkUser } from '../../helpers/testUtils.js';
import { AbstractConnectionListener } from '../../../roborockCommunication/routing/listeners/abstractConnectionListener.js';
import { V1ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { PendingResponseTracker } from '../../../roborockCommunication/routing/services/pendingResponseTracker.js';

class TestClient extends AbstractClient {
  protected clientName = 'TestClient';
  protected shouldReconnect = false;
  private connected = false;

  constructor(
    logger: any,
    context: MessageContext,
    responseBroadcaster: ResponseBroadcaster,
    responseTracker: PendingResponseTracker,
  ) {
    super(logger, context, responseBroadcaster, responseTracker);
    this.initializeConnectionStateListener(asPartial<AbstractClient>({}));
  }

  override isConnected(): boolean {
    return this.connected;
  }

  override connect(): void {
    this.connected = true;
  }

  override async disconnect(): Promise<void> {
    this.connected = false;
  }

  protected override sendInternal(duid: string, request: RequestMessage): void {
    // Mock implementation - do nothing
  }
}

describe('AbstractClient', () => {
  let client: TestClient;
  let logger: any;
  let context: MessageContext;
  let responseTracker: V1PendingResponseTracker;
  let responseBroadcaster: V1ResponseBroadcaster;

  beforeEach(() => {
    logger = createMockLogger();
    const userdata = mkUser();
    context = new MessageContext(userdata);
    responseTracker = new V1PendingResponseTracker(logger);
    responseBroadcaster = new V1ResponseBroadcaster(responseTracker, logger);
    client = new TestClient(logger, context, responseBroadcaster, responseTracker);
  });

  it('get resolves when responseTracker receives response', async () => {
    const request = asPartial<RequestMessage>({ messageId: 123, method: 'test_method' });
    const mockResponse = asPartial<ResponseMessage>({
      duid: 'DUID123',
      header: asPartial({}),
      get: () => 'response_data',
      isForProtocol: () => true,
      isForProtocols: () => true,
      isForStatus: () => true,
    });

    vi.spyOn(responseTracker, 'waitFor').mockResolvedValue(mockResponse);

    const result = await client.get<unknown>('DUID123', request);
    expect(result).toEqual(mockResponse);
  });

  it('get returns undefined when error occurs', async () => {
    const request = asPartial<RequestMessage>({ messageId: 456, method: 'failing_method' });

    vi.spyOn(responseTracker, 'waitFor').mockRejectedValue(new Error('test error'));

    const result = await client.get<unknown>('DUID456', request);
    expect(result).toBeUndefined();
    expect(vi.mocked(logger.error).mock.calls.some((args: unknown[]) => String(args[0]).includes('test error'))).toBe(
      true,
    );
  });

  it('registerDevice delegates to context', () => {
    const spy = vi.spyOn(context, 'registerDevice');
    client.registerDevice('DUID789', 'localKey123', '1.0', 12345);
    expect(spy).toHaveBeenCalledWith('DUID789', 'localKey123', '1.0', 12345);
  });

  it('registerConnectionListener adds listener to chain', () => {
    const listener = asPartial<AbstractConnectionListener>({ onConnected: vi.fn() });
    client.registerConnectionListener(listener);
    expect(asType<TestClient>(client)['connectionBroadcaster']['listeners']).toContain(listener);
  });

  it('registerMessageListener adds listener to chain', () => {
    const listener = asPartial<{ name: string; duid: string; onMessage: (...args: unknown[]) => void }>({
      name: 'test-listener',
      duid: 'DUID123',
      onMessage: vi.fn(),
    });
    client.registerMessageListener(listener);
    expect((asType<TestClient>(client)['responseBroadcaster'] as V1ResponseBroadcaster)['listeners']).toContain(
      listener,
    );
  });

  it('isConnected returns connection state', () => {
    expect(client.isConnected()).toBe(false);
    client.connect();
    expect(client.isConnected()).toBe(true);
  });
});
