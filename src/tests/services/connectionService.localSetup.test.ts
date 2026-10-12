import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('nodemailer', () => ({
	default: {
		createTransport: vi.fn().mockReturnValue({
			sendMail: vi.fn().mockResolvedValue(undefined),
		}),
	},
}));

vi.mock('../../roborockCommunication/local/udpClient.js', () => ({
	LocalNetworkUDPClient: vi.fn(function () {
		return udpStub;
	}),
}));

vi.mock('../../roborockCommunication/routing/listeners/implementation/mapInfoListener.js', () => ({
	MapInfoListener: vi.fn(function () {
		return { name: 'MapInfoListener' };
	}),
}));

import type { AnsiLogger } from 'matterbridge/logger';

import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/protocolVersion.js';
import type { LocalNetworkUDPClient } from '../../roborockCommunication/local/udpClient.js';
import {
	Device,
	DeviceModel,
	DeviceSpecs,
	Protocol,
	ResponseMessage,
	RPC_Request_Segments,
} from '../../roborockCommunication/models/index.js';
import type { Client } from '../../roborockCommunication/routing/client.js';
import type { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import { MapInfoListener } from '../../roborockCommunication/routing/listeners/implementation/mapInfoListener.js';
import type { AreaManagementService } from '../../services/areaManagementService.js';
import type ClientManager from '../../services/clientManager.js';
import { ConnectionService } from '../../services/connectionService.js';
import type { MessageRoutingService } from '../../services/messageRoutingService.js';
import { type DeviceNotifyCallback, NotifyMessageTypes } from '../../types/index.js';
import { asPartial, asType, makeLocalClientStub, makeLogger, makeMockClientRouter } from '../testUtils.js';

type UdpListener = Parameters<LocalNetworkUDPClient['registerListener']>[0];
type RegisteredListener = Parameters<ClientRouter['registerMessageListener']>[0];

const { udpStub } = vi.hoisted(() => ({
	udpStub: {
		registerListener: vi.fn(),
		connect: vi.fn(),
	},
}));

const V1_DUID = 'v1-duid';
const B01_DUID = 'b01-duid';

function createMockClientManager(clientRouter: ClientRouter): ClientManager {
	return asPartial<ClientManager>({ get: vi.fn().mockReturnValue(clientRouter) });
}

function createMockMessageRoutingService(): MessageRoutingService {
	return asPartial<MessageRoutingService>({ registerMessageDispatcher: vi.fn() });
}

function createMockAreaManagementService(): AreaManagementService {
	return asPartial<AreaManagementService>({
		isMultipleMapEnabled: vi.fn().mockReturnValue(true),
		setV1ResolvedSegment: vi.fn(),
	});
}

function createConfigManager(liveMapUpdates: boolean): PlatformConfigManager {
	return asPartial<PlatformConfigManager>({ isLiveMapUpdatesEnabled: liveMapUpdates });
}

function createV1Device(overrides: Partial<Device> = {}): Device {
	return asPartial<Device>({
		duid: V1_DUID,
		localKey: 'local-key',
		pv: ProtocolVersion.V1,
		serialNumber: 'SN1',
		specs: asPartial<DeviceSpecs>({ protocol: ProtocolVersion.V1, model: DeviceModel.S6 }),
		store: asType<Device['store']>({ homeData: { rooms: [] } }),
		...overrides,
	});
}

function createB01Device(overrides: Partial<Device> = {}): Device {
	return asPartial<Device>({
		duid: B01_DUID,
		localKey: 'local-key',
		pv: ProtocolVersion.B01,
		serialNumber: 'SN2',
		specs: asPartial<DeviceSpecs>({ protocol: ProtocolVersion.B01, model: DeviceModel.Q10_S5_PLUS }),
		store: asType<Device['store']>({ homeData: { rooms: [] } }),
		...overrides,
	});
}

describe('ConnectionService local setup', () => {
	let mockLogger: ReturnType<typeof makeLogger>;
	let mockClientRouter: ClientRouter;
	let mockClientManager: ClientManager;
	let mockMessageRoutingService: MessageRoutingService;
	let mockAreaManagementService: AreaManagementService;
	let mockDeviceNotify: Mock<DeviceNotifyCallback>;
	let localClient: ReturnType<typeof makeLocalClientStub>;
	let service: ConnectionService;

	function createService(configManager?: PlatformConfigManager): ConnectionService {
		return new ConnectionService(
			mockClientManager,
			asType<AnsiLogger>(mockLogger),
			mockMessageRoutingService,
			configManager,
			mockAreaManagementService,
		);
	}

	function getRegisteredListener(name: string): RegisteredListener {
		const listener = vi
			.mocked(mockClientRouter.registerMessageListener)
			.mock.calls.map(([registered]) => registered)
			.find((registered) => registered.name === name);
		if (!listener) {
			throw new Error(`Listener ${name} was not registered`);
		}
		return listener;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = makeLogger();
		mockClientRouter = makeMockClientRouter({
			getSerializeNonce: vi.fn().mockReturnValue(Buffer.from('nonce')),
		});
		mockClientManager = createMockClientManager(mockClientRouter);
		mockMessageRoutingService = createMockMessageRoutingService();
		mockAreaManagementService = createMockAreaManagementService();
		mockDeviceNotify = vi.fn<DeviceNotifyCallback>();
		localClient = makeLocalClientStub();
		vi.mocked(mockClientRouter.registerClient).mockReturnValue(asType<Client>(localClient));

		service = createService(createConfigManager(false));
		service.setDeviceNotify(mockDeviceNotify);
		service.clientRouter = mockClientRouter;
	});

	describe('area management wiring', () => {
		it('should construct MapInfoListener with device rooms, area service and V1 flags', async () => {
			const device = createV1Device();

			await service.initializeMessageClientForLocal(device);

			expect(MapInfoListener).toHaveBeenCalledWith(
				V1_DUID,
				device.store.homeData.rooms,
				mockAreaManagementService,
				mockLogger,
				DeviceModel.S6,
				'SN1',
				expect.any(Function),
				ProtocolVersion.V1,
				false,
				true,
				expect.any(Function),
				expect.any(Function),
			);
			expect(mockClientRouter.registerMessageListener).toHaveBeenCalledWith(
				vi.mocked(MapInfoListener).mock.results[0].value,
			);
		});

		it('should notify ActiveMapChanged with duid and mapId when the listener reports a map change', async () => {
			await service.initializeMessageClientForLocal(createV1Device());

			vi.mocked(MapInfoListener).mock.calls[0][6]?.(7);

			expect(mockDeviceNotify).toHaveBeenCalledWith({
				type: NotifyMessageTypes.ActiveMapChanged,
				data: { duid: V1_DUID, mapId: 7 },
			});
		});

		it('should return the client nonce when the listener requests one', async () => {
			await service.initializeMessageClientForLocal(createV1Device());

			const nonce = vi.mocked(MapInfoListener).mock.calls[0][10]?.();

			expect(mockClientRouter.getSerializeNonce).toHaveBeenCalled();
			expect(nonce).toEqual(Buffer.from('nonce'));
		});

		it('should return undefined nonce when the client router has been shut down', async () => {
			await service.initializeMessageClientForLocal(createV1Device());
			service.clientRouter = undefined;

			const nonce = vi.mocked(MapInfoListener).mock.calls[0][10]?.();

			expect(nonce).toBeUndefined();
		});

		it('should forward resolved V1 segment to area management when the listener resolves a room', async () => {
			await service.initializeMessageClientForLocal(createV1Device());

			vi.mocked(MapInfoListener).mock.calls[0][11]?.(42);

			expect(mockAreaManagementService.setV1ResolvedSegment).toHaveBeenCalledWith(V1_DUID, 42);
		});

		it.each([
			{ label: 'V1 device with live map updates disabled', device: 'v1', live: false, expected: false },
			{ label: 'V1 device with live map updates enabled', device: 'v1', live: true, expected: true },
			{ label: 'B01 Q10 device without map query response', device: 'b01', live: false, expected: true },
			{ label: 'V1 device without config manager', device: 'v1', live: undefined, expected: false },
		])('should pass allowV1AreaUpdate=$expected for $label', async ({ device, live, expected }) => {
			service = createService(live === undefined ? undefined : createConfigManager(live));
			service.setDeviceNotify(mockDeviceNotify);
			service.clientRouter = mockClientRouter;

			await service.initializeMessageClientForLocal(device === 'v1' ? createV1Device() : createB01Device());

			expect(vi.mocked(MapInfoListener).mock.calls[0][8]).toBe(expected);
		});
	});

	describe('V1 status listener refresh', () => {
		it('should request device status when V1StatusListener receives additional props', async () => {
			await service.initializeMessageClientForLocal(createV1Device());
			const dispatcher = vi.mocked(mockMessageRoutingService.registerMessageDispatcher).mock.calls[0][1];
			const getDeviceStatusSpy = vi.spyOn(dispatcher, 'getDeviceStatus').mockResolvedValue(undefined);
			const listener = getRegisteredListener('V1StatusListener');

			await listener.onMessage(
				asPartial<ResponseMessage>({
					duid: V1_DUID,
					body: asType<ResponseMessage['body']>({
						get: (protocol: Protocol) => (protocol === Protocol.additional_props ? {} : undefined),
					}),
				}),
			);

			expect(getDeviceStatusSpy).toHaveBeenCalledWith(V1_DUID);
		});
	});

	describe('B01 UDP and local setup', () => {
		it('should connect local client using network info from device status when IP is present', async () => {
			const device = createB01Device({
				deviceStatus: {
					[Protocol.rpc_request]: {
						[RPC_Request_Segments.network_info]: { ipAddress: '10.0.0.5' },
					},
				},
			});

			const result = await service.initializeMessageClientForLocal(device);

			expect(result).toBe(true);
			expect(mockClientRouter.registerClient).toHaveBeenCalledWith(B01_DUID, '10.0.0.5');
			expect(service.ipMap.get(B01_DUID)).toBe('10.0.0.5');
			expect(service.localClientMap.has(B01_DUID)).toBe(true);
			expect(udpStub.connect).not.toHaveBeenCalled();
		});

		it.each([
			{ label: 'deviceStatus is undefined', deviceStatus: undefined },
			{ label: 'deviceStatus is empty', deviceStatus: {} },
		])('should fall back to UDP broadcast listening when $label', async ({ deviceStatus }) => {
			const device = createB01Device({ deviceStatus });

			const result = await service.initializeMessageClientForLocal(device);

			expect(result).toBe(true);
			expect(udpStub.registerListener).toHaveBeenCalledTimes(1);
			expect(udpStub.connect).toHaveBeenCalledTimes(1);
		});

		it('should set up local client when a UDP broadcast is received', async () => {
			await service.initializeMessageClientForLocal(createB01Device());
			const udpListener = vi.mocked(udpStub.registerListener).mock.calls[0][0] as UdpListener;

			await udpListener.onMessage(B01_DUID, '10.0.0.9');

			expect(mockLogger.debug).toHaveBeenCalledWith(`Received UDP broadcast from device ${B01_DUID} at IP 10.0.0.9`);
			expect(mockClientRouter.registerClient).toHaveBeenCalledWith(B01_DUID, '10.0.0.9');
			expect(service.ipMap.get(B01_DUID)).toBe('10.0.0.9');
		});

		it('should log error and skip local setup when a UDP broadcast arrives after shutdown', async () => {
			await service.initializeMessageClientForLocal(createB01Device());
			const udpListener = vi.mocked(udpStub.registerListener).mock.calls[0][0] as UdpListener;
			await service.shutdown();

			await udpListener.onMessage(B01_DUID, '10.0.0.9');

			expect(mockLogger.error).toHaveBeenCalledWith('clientRouter not initialized');
			expect(mockClientRouter.registerClient).not.toHaveBeenCalled();
		});
	});

	describe('V1 cached and fetched IP', () => {
		it('should use cached IP without fetching network info when IP is already known', async () => {
			service.ipMap.set(V1_DUID, '192.168.1.5');

			const result = await service.initializeMessageClientForLocal(createV1Device());

			expect(result).toBe(true);
			expect(mockClientRouter.registerClient).toHaveBeenCalledWith(V1_DUID, '192.168.1.5');
			expect(mockClientRouter.query).not.toHaveBeenCalled();
		});

		it('should fetch network info and connect when IP is not cached', async () => {
			mockClientRouter.query = vi.fn().mockResolvedValue({ ip: '192.168.1.7' });

			const result = await service.initializeMessageClientForLocal(createV1Device());

			expect(result).toBe(true);
			expect(mockClientRouter.registerClient).toHaveBeenCalledWith(V1_DUID, '192.168.1.7');
			expect(service.ipMap.get(V1_DUID)).toBe('192.168.1.7');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('attempting local connection at IP 192.168.1.7'),
			);
		});
	});
});
