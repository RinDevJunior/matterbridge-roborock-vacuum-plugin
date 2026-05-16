import { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtocolVersion } from '../../../../roborockCommunication/enums/index.js';
import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { MessageContext } from '../../../../roborockCommunication/models/messageContext.js';
import { AbstractMessageListener } from '../../../../roborockCommunication/routing/listeners/abstractMessageListener.js';
import { ResponseBroadcasterFactory } from '../../../../roborockCommunication/routing/listeners/responseBroadcasterFactory.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

function makeV1Response(duid = 'v1-duid'): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	const body = new ResponseBody({
		'102': {
			id: 123,
			result: [
				{
					max_multi_map: 1,
					max_bak_map: 1,
					multi_map_count: 1,
					map_info: [
						{
							mapFlag: 0,
							add_time: 1772129131,
							length: 8,
							name: 'Upstairs',
							bak_maps: [{ mapFlag: 4, add_time: 1771954828 }],
						},
					],
				},
			],
		},
	});
	return new ResponseMessage(duid, header, body);
}

function makeB01Response(duid = 'b01-duid'): ResponseMessage {
	const header = new HeaderMessage('B01', 1, 0, 101, 102);
	const body = new ResponseBody({ '101': { '108': 4 } });
	return new ResponseMessage(duid, header, body);
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
		const v1Listener: AbstractMessageListener = { name: 'V1Listener', duid: 'v1-duid', onMessage: vi.fn() };
		const b01Listener: AbstractMessageListener = { name: 'B01Listener', duid: 'b01-duid', onMessage: vi.fn() };
		factory.register(v1Listener);
		factory.register(b01Listener);

		const v1Response = makeV1Response();
		factory.onMessage(v1Response);
		expect(v1Listener.onMessage).toHaveBeenCalledWith(v1Response);

		const b01Response = makeB01Response();
		factory.onMessage(b01Response);
		expect(b01Listener.onMessage).toHaveBeenCalledWith(b01Response);
	});

	it('should unregister from both broadcasters', () => {
		const listener: AbstractMessageListener = { name: 'TestListener', duid: 'test', onMessage: vi.fn() };
		factory.register(listener);
		factory.unregister();

		factory.onMessage(makeV1Response());
		factory.onMessage(makeB01Response());
		expect(listener.onMessage).not.toHaveBeenCalled();
	});

	it('should route onMessage to V1 broadcaster for V1 responses', () => {
		const listener: AbstractMessageListener = { name: 'TestListener', duid: 'v1-duid', onMessage: vi.fn() };
		factory.register(listener);

		const response = makeV1Response();
		factory.onMessage(response);
		expect(listener.onMessage).toHaveBeenCalledWith(response);
	});

	it('should route onMessage to B01 broadcaster for B01 responses', () => {
		const listener: AbstractMessageListener = { name: 'TestListener', duid: 'b01-duid', onMessage: vi.fn() };
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

		const listener: AbstractMessageListener = { name: 'TestListener', duid: 'some-duid', onMessage: vi.fn() };
		factory.register(listener);

		factory.onMessage(response);
		expect(context.getMQTTProtocolVersion).toHaveBeenCalledWith('some-duid');
		expect(listener.onMessage).toHaveBeenCalledWith(response);
	});

	it('should fall back to V1 broadcaster when protocol version is not B01', () => {
		vi.mocked(context.getMQTTProtocolVersion).mockReturnValue(ProtocolVersion.V1);

		const header = new HeaderMessage(undefined as unknown as string, 1, 0, 101, 102);
		const body = new ResponseBody({
			'102': {
				id: 123,
				result: [
					{
						max_multi_map: 1,
						max_bak_map: 1,
						multi_map_count: 1,
						map_info: [
							{
								mapFlag: 0,
								add_time: 1772129131,
								length: 8,
								name: 'Upstairs',
								bak_maps: [{ mapFlag: 4, add_time: 1771954828 }],
							},
						],
					},
				],
			},
		});
		const response = new ResponseMessage('v1-duid', header, body);

		const listener: AbstractMessageListener = { name: 'TestListener', duid: 'v1-duid', onMessage: vi.fn() };
		factory.register(listener);

		factory.onMessage(response);
		expect(listener.onMessage).toHaveBeenCalledWith(response);
	});
});
