import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbstractClient } from '../../../roborockCommunication/routing/abstractClient.js';
import { MessageContext, RequestMessage } from '../../../roborockCommunication/models/index.js';
import { ChainedMessageListener } from '../../../roborockCommunication/routing/listeners/implementation/chainedMessageListener.js';
import { PendingResponseTracker } from '../../../roborockCommunication/routing/services/pendingResponseTracker.js';

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

function makeLogger() {
  const calls: { error: string[]; notice: string[]; info: string[]; debug: string[] } = {
    error: [],
    notice: [],
    info: [],
    debug: [],
  };
  return {
    error: (m: string) => calls.error.push(m),
    notice: (m: string) => calls.notice.push(m),
    info: (m: string) => calls.info.push(m),
    debug: (m: string) => calls.debug.push(m),
    __calls: calls,
  } as any;
}

describe('AbstractClient', () => {
  let client: TestClient;
  let logger: any;
  let context: MessageContext;
  let responseTracker: PendingResponseTracker;
  let chainedMessageListener: ChainedMessageListener;

  beforeEach(() => {
    logger = makeLogger();
    const userdata: any = { rriot: { k: 'secretkey' } };
    context = new MessageContext(userdata);
    responseTracker = new PendingResponseTracker(logger);
    chainedMessageListener = new ChainedMessageListener(responseTracker, logger);
    client = new TestClient(logger, context, chainedMessageListener, responseTracker);
  });

  it('get resolves when responseTracker receives response', async () => {
    const request = { messageId: 123, method: 'test_method' } as any;
    const mockResponse = { data: 'response_data' } as any;

    vi.spyOn(responseTracker, 'waitFor').mockResolvedValue(mockResponse);

    const result = await client.get<any>('DUID123', request);
    expect(result).toEqual(mockResponse);
  });

  it('get returns undefined when error occurs', async () => {
    const request = { messageId: 456, method: 'failing_method' } as any;

    vi.spyOn(responseTracker, 'waitFor').mockRejectedValue(new Error('test error'));

    const result = await client.get<any>('DUID456', request);
    expect(result).toBeUndefined();
    expect(logger.__calls.error.some((m: string) => m.includes('test error'))).toBe(true);
  });

  it('registerDevice delegates to context', () => {
    const spy = vi.spyOn(context, 'registerDevice');
    client.registerDevice('DUID789', 'localKey123', '1.0', 12345);
    expect(spy).toHaveBeenCalledWith('DUID789', 'localKey123', '1.0', 12345);
  });

  it('registerConnectionListener adds listener to chain', () => {
    const listener = { onConnected: vi.fn() } as any;
    client.registerConnectionListener(listener);
    expect((client as any).connectionListener.listeners).toContain(listener);
  });

  it('registerMessageListener adds listener to chain', () => {
    const listener = { onMessage: vi.fn() } as any;
    client.registerMessageListener(listener);
    expect((client as any).chainedMessageListener.listeners).toContain(listener);
  });

  it('isConnected returns connection state', () => {
    expect(client.isConnected()).toBe(false);
    client.connect();
    expect(client.isConnected()).toBe(true);
  });
});
