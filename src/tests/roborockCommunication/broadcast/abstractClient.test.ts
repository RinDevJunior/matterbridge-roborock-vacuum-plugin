import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbstractClient } from '../../../roborockCommunication/routing/abstractClient.js';
import { MessageContext, RequestMessage, UserData, ResponseMessage } from '../../../roborockCommunication/models/index.js';
import { ChainedMessageListener } from '../../../roborockCommunication/routing/listeners/implementation/chainedMessageListener.js';
import { PendingResponseTracker } from '../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { createMockLogger, asPartial, asType, mkUser } from '../../helpers/testUtils.js';
import { AbstractConnectionListener } from '../../../roborockCommunication/routing/listeners/abstractConnectionListener.js';

class TestClient extends AbstractClient {
  protected clientName = 'TestClient';
  protected shouldReconnect = false;

  constructor(logger: any, context: MessageContext, chainedMessageListener: ChainedMessageListener, responseTracker: PendingResponseTracker) {
    super(logger, context, chainedMessageListener, responseTracker);
    this.initializeConnectionStateListener();
  }

  public override isReady(): boolean {
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
  let responseTracker: PendingResponseTracker;
  let chainedMessageListener: ChainedMessageListener;

  beforeEach(() => {
    logger = createMockLogger();
    const userdata = mkUser();
    context = new MessageContext(userdata);
    responseTracker = new PendingResponseTracker(logger);
    chainedMessageListener = new ChainedMessageListener(responseTracker, logger);
    client = new TestClient(logger, context, chainedMessageListener, responseTracker);
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
    expect(vi.mocked(logger.error).mock.calls.some((args: unknown[]) => String(args[0]).includes('test error'))).toBe(true);
  });

  it('registerDevice delegates to context', () => {
    const spy = vi.spyOn(context, 'registerDevice');
    client.registerDevice('DUID789', 'localKey123', '1.0', 12345);
    expect(spy).toHaveBeenCalledWith('DUID789', 'localKey123', '1.0', 12345);
  });

  it('registerConnectionListener adds listener to chain', () => {
    const listener = asPartial<AbstractConnectionListener>({ onConnected: vi.fn() });
    client.registerConnectionListener(listener);
    expect(asType<TestClient>(client)['connectionListener']['listeners']).toContain(listener);
  });

  it('registerMessageListener adds listener to chain', () => {
    const listener = asPartial<{ name: string; onMessage: (...args: unknown[]) => void }>({ name: 'test-listener', onMessage: vi.fn() });
    client.registerMessageListener(listener);
    expect(asType<TestClient>(client)['chainedMessageListener']['listeners']).toContain(listener);
  });

  it('isConnected returns connection state', () => {
    expect(client.isConnected()).toBe(false);
    client.connect();
    expect(client.isConnected()).toBe(true);
  });
});
