import type { AnsiLogger } from 'matterbridge/logger';
import { describe, expect, it, vi } from 'vitest';

import { MessageContext, RequestMessage } from '../../../roborockCommunication/models/index.js';
import { AbstractClient } from '../../../roborockCommunication/routing/abstractClient.js';
import type { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { V1ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { asPartial, asType, createMockLogger, mkUser } from '../../helpers/testUtils.js';

class StubClient extends AbstractClient {
	protected clientName = 'StubClient';
	private readonly onSend: (duid: string, request: RequestMessage) => void;

	constructor(
		logger: AnsiLogger,
		context: MessageContext,
		responseBroadcaster: ResponseBroadcaster,
		onSend: (duid: string, request: RequestMessage) => void,
	) {
		super(logger, context, responseBroadcaster);
		this.onSend = onSend;
	}

	isConnected(): boolean {
		return false;
	}

	protected sendInternal(duid: string, request: RequestMessage): void {
		this.onSend(duid, request);
	}
}

describe('AbstractClient (gap coverage)', () => {
	it('should log the raw string and resolve undefined when sendInternal throws a non-Error during query', async () => {
		// Arrange
		const logger = createMockLogger();
		const context = new MessageContext(mkUser());
		const broadcaster = new V1ResponseBroadcaster(logger);
		const client = new StubClient(logger, context, broadcaster, () => {
			throw asType<Error>('boom');
		});
		const request = asPartial<RequestMessage>({ messageId: 7, method: 'test_method' });

		// Act
		const result = await client.query<string>('DUID1', request, () => undefined, 1000);

		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('boom');
	});

	it('should log the Error message and resolve undefined when sendInternal throws an Error during query', async () => {
		// Arrange
		const logger = createMockLogger();
		const context = new MessageContext(mkUser());
		const broadcaster = new V1ResponseBroadcaster(logger);
		const client = new StubClient(logger, context, broadcaster, () => {
			throw new Error('send failed');
		});
		const request = asPartial<RequestMessage>({ messageId: 8, method: 'test_method' });

		// Act
		const result = await client.query<string>('DUID1', request, () => undefined, 1000);

		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('send failed');
	});
});
