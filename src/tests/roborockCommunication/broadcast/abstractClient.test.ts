import { jest } from '@jest/globals';
import { AbstractClient } from '../../../roborockCommunication/broadcast/abstractClient';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';
import { RequestMessage } from '../../../roborockCommunication/broadcast/model/requestMessage';

class TestClient extends AbstractClient {
  protected clientName = 'TestClient';
  protected shouldReconnect = false;

  constructor(logger: any, context: MessageContext) {
    super(logger, context);
    this.initializeConnectionStateListener();
  }

  connect(): void {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(_duid: string, _request: RequestMessage): Promise<void> {
    // Simulating send
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

  test('get resolves when syncMessageListener receives response', async () => {
    jest.useFakeTimers();
    const request = { messageId: 123, method: 'test_method' } as any;
    const mockResponse = { data: 'response_data' } as any;

    // Spy on waitFor to manually resolve
    const listener = (client as any).syncMessageListener;
    listener.waitFor = jest.fn((_msgId: number, _req: RequestMessage, resolve: any, _reject: any) => {
      // Immediately resolve without timeout
      resolve(mockResponse);
    });

    const result = await client.get<any>('DUID123', request);
    expect(result).toEqual(mockResponse);
    jest.useRealTimers();
  });

  test('get returns undefined when error occurs', async () => {
    jest.useFakeTimers();
    const request = { messageId: 456, method: 'failing_method' } as any;

    // Spy on waitFor to manually reject
    const listener = (client as any).syncMessageListener;
    listener.waitFor = jest.fn((msgId: number, req: RequestMessage, resolve: any, reject: any) => {
      reject(new Error('test error'));
    });

    const result = await client.get<any>('DUID456', request);
    expect(result).toBeUndefined();
    expect(logger.__calls.error.some((m: string) => m.includes('test error'))).toBe(true);
    jest.useRealTimers();
  });

  test('registerDevice delegates to context', () => {
    const spy = jest.spyOn(context, 'registerDevice');
    client.registerDevice('DUID789', 'localKey123', '1.0', 12345);
    expect(spy).toHaveBeenCalledWith('DUID789', 'localKey123', '1.0', 12345);
  });

  test('registerConnectionListener adds listener to chain', () => {
    const listener = { onConnected: jest.fn() } as any;
    client.registerConnectionListener(listener);
    expect((client as any).connectionListeners.listeners).toContain(listener);
  });

  test('registerMessageListener adds listener to chain', () => {
    const listener = { onMessage: jest.fn() } as any;
    client.registerMessageListener(listener);
    expect((client as any).messageListeners.listeners).toContain(listener);
  });

  test('isConnected returns connection state', () => {
    expect(client.isConnected()).toBe(false);
    client.connect();
    expect(client.isConnected()).toBe(true);
  });
});
