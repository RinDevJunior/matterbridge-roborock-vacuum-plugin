import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageContext, RequestMessage, ResponseMessage } from '../../../roborockCommunication/models/index.js';
import { AbstractClient } from '../../../roborockCommunication/routing/abstractClient.js';
import { AbstractConnectionListener } from '../../../roborockCommunication/routing/listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from '../../../roborockCommunication/routing/listeners/abstractMessageListener.js';
import { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { V1ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { asPartial, asType, createMockLogger, mkUser } from '../../helpers/testUtils.js';

class TestClient extends AbstractClient {
	protected clientName = 'TestClient';
	protected shouldReconnect = false;
	private connected = false;

	constructor(logger: any, context: MessageContext, responseBroadcaster: ResponseBroadcaster) {
		super(logger, context, responseBroadcaster);
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

	protected override sendInternal(_duid: string, _request: RequestMessage): void {
		// Mock implementation - do nothing
	}
}

describe('AbstractClient', () => {
	let client: TestClient;
	let logger: any;
	let context: MessageContext;
	let responseBroadcaster: V1ResponseBroadcaster;

	beforeEach(() => {
		logger = createMockLogger();
		const userdata = mkUser();
		context = new MessageContext(userdata);
		responseBroadcaster = new V1ResponseBroadcaster(logger);
		client = new TestClient(logger, context, responseBroadcaster);
	});

	it('query resolves when broadcaster dispatches a matching message', async () => {
		const request = asPartial<RequestMessage>({ messageId: 123, method: 'test_method' });
		const msg = asPartial<ResponseMessage>({ duid: 'DUID123', isSimpleOkResponse: () => false });

		vi.spyOn(client as any, 'sendInternal').mockImplementation(() => {
			// Defer so waitFor() has a chance to set this.resolve before onMessage fires
			void Promise.resolve().then(() => responseBroadcaster.onMessage(msg));
		});

		const parseFn = vi.fn().mockReturnValue('parsed-value');
		const result = await client.query<string>('DUID123', request, parseFn);
		expect(result).toBe('parsed-value');
	});

	it('query returns undefined when timeout occurs', async () => {
		const request = asPartial<RequestMessage>({ messageId: 456, method: 'failing_method' });
		vi.spyOn(client as any, 'sendInternal').mockImplementation(() => {});

		const result = await client.query<string>('DUID456', request, () => undefined, 1);
		expect(result).toBeUndefined();
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
		const listener = asPartial<AbstractMessageListener>({
			name: 'test-listener',
			duid: 'DUID123',
			onMessage: vi.fn().mockResolvedValue(undefined),
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

	it('isReady delegates to isConnected', () => {
		expect(client.isReady()).toBe(false);
		client.connect();
		expect(client.isReady()).toBe(true);
	});
});
