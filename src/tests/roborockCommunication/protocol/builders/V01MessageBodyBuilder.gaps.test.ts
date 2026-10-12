import { describe, expect, it } from 'vitest';

import { MessageContext, RequestMessage } from '../../../../roborockCommunication/models/index.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import { V01MessageBodyBuilder } from '../../../../roborockCommunication/protocol/builders/V01MessageBodyBuilder.js';
import { mkUser } from '../../../helpers/testUtils.js';

interface OuterPayload {
	dps: Record<string, string>;
	t: number;
}

interface InnerPayload {
	id: number;
	method: string;
	params?: unknown[];
	security?: { endpoint: string; nonce: string };
}

function parseInner(serialized: string, protocol: Protocol): InnerPayload {
	const outer = JSON.parse(serialized) as OuterPayload;
	return JSON.parse(outer.dps[String(protocol)]) as InnerPayload;
}

describe('V01MessageBodyBuilder.buildPayload', () => {
	it('should serialize an empty method string when the request has no method', () => {
		// Arrange
		const builder = new V01MessageBodyBuilder();
		const context = new MessageContext(mkUser());
		const request = new RequestMessage({ messageId: 7, protocol: Protocol.rpc_request, timestamp: 1700000000 });
		// Act
		const serialized = builder.buildPayload(request, context);
		// Assert
		expect(parseInner(serialized, Protocol.rpc_request).method).toBe('');
	});

	it('should include a security block with endpoint and nonce when the request is secure', () => {
		// Arrange
		const builder = new V01MessageBodyBuilder();
		const context = new MessageContext(mkUser());
		const request = new RequestMessage({
			messageId: 8,
			protocol: Protocol.rpc_request,
			method: 'get_status',
			params: [1],
			secure: true,
			timestamp: 1,
		});
		// Act
		const serialized = builder.buildPayload(request, context);
		// Assert
		const inner = parseInner(serialized, Protocol.rpc_request);
		expect(inner.security).toEqual({
			endpoint: context.getEndpoint(),
			nonce: context.getSerializeNonceAsHex(),
		});
		expect(inner.params).toEqual([1]);
	});

	it('should omit the security block when the request is not secure', () => {
		// Arrange
		const builder = new V01MessageBodyBuilder();
		const context = new MessageContext(mkUser());
		const request = new RequestMessage({
			messageId: 9,
			protocol: Protocol.rpc_request,
			method: 'get_status',
			timestamp: 1,
		});
		// Act
		const serialized = builder.buildPayload(request, context);
		// Assert
		expect(parseInner(serialized, Protocol.rpc_request)).not.toHaveProperty('security');
	});

	it('should set the outer timestamp from the request timestamp', () => {
		// Arrange
		const builder = new V01MessageBodyBuilder();
		const context = new MessageContext(mkUser());
		const request = new RequestMessage({ messageId: 10, protocol: Protocol.rpc_request, timestamp: 1700000123 });
		// Act
		const outer = JSON.parse(builder.buildPayload(request, context)) as OuterPayload;
		// Assert
		expect(outer.t).toBe(1700000123);
	});
});
