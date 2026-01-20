import { AbstractClient, MessageContext, RequestMessage } from '@/roborockCommunication/index.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

class TestClient extends AbstractClient {
  protected clientName = 'TestClient';
  protected shouldReconnect = false;

  constructor(logger: any, context: MessageContext) {
    super(logger, context);
    this.initializeConnectionStateListener();
  }

  override isReady(): boolean {
    return true;
  }

  override connect(): void {
    this.connected = true;
  }

  override async disconnect(): Promise<void> {
    this.connected = false;
  }

  protected override sendInternal(duid: string, request: RequestMessage): void {
    throw new Error('Method not implemented.');
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

  beforeEach(() => {
    logger = makeLogger();
    const userdata: any = { rriot: { k: 'secretkey' } };
    context = new MessageContext(userdata);
    client = new TestClient(logger, context);
  });

  it('get resolves when syncMessageListener receives response', async () => {
    vi.useFakeTimers();
    const request = { messageId: 123, method: 'test_method' } as any;
    const mockResponse = { data: 'response_data' } as any;

    // Spy on waitFor to manually resolve
    const listener = (client as any).syncMessageListener;
    listener.waitFor = vi.fn((_msgId: number, _req: RequestMessage, resolve: any, _reject: any) => {
      // Immediately resolve without timeout
      resolve(mockResponse);
    });

    const result = await client.get<any>('DUID123', request);
    expect(result).toEqual(mockResponse);
    vi.useRealTimers();
  });

  it('get returns undefined when error occurs', async () => {
    vi.useFakeTimers();
    const request = { messageId: 456, method: 'failing_method' } as any;

    // Spy on waitFor to manually reject
    const listener = (client as any).syncMessageListener;
    listener.waitFor = vi.fn((msgId: number, req: RequestMessage, resolve: any, reject: any) => {
      reject(new Error('test error'));
    });

    const result = await client.get<any>('DUID456', request);
    expect(result).toBeUndefined();
    expect(logger.__calls.error.some((m: string) => m.includes('test error'))).toBe(true);
    vi.useRealTimers();
  });

  it('registerDevice delegates to context', () => {
    const spy = vi.spyOn(context, 'registerDevice');
    client.registerDevice('DUID789', 'localKey123', '1.0', 12345);
    expect(spy).toHaveBeenCalledWith('DUID789', 'localKey123', '1.0', 12345);
  });

  it('registerConnectionListener adds listener to chain', () => {
    const listener = { onConnected: vi.fn() } as any;
    client.registerConnectionListener(listener);
    expect((client as any).connectionListeners.listeners).toContain(listener);
  });

  it('registerMessageListener adds listener to chain', () => {
    const listener = { onMessage: vi.fn() } as any;
    client.registerMessageListener(listener);
    expect((client as any).messageListeners.listeners).toContain(listener);
  });

  it('isConnected returns connection state', () => {
    expect(client.isConnected()).toBe(false);
    client.connect();
    expect(client.isConnected()).toBe(true);
  });
});
