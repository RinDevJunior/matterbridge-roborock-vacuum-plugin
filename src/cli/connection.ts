import { AnsiLogger } from 'matterbridge/logger';

import { AbstractMessageDispatcher } from '../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MessageDispatcherFactory } from '../roborockCommunication/protocol/dispatcher/dispatcherFactory.js';
import { Client } from '../roborockCommunication/routing/client.js';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { LoggingMessageListener } from './loggingMessageListener.js';
import { CliSession, CONNECT_POLL_MS, CONNECT_TIMEOUT_MS } from './types.js';

export interface DeviceConnection {
	clientRouter: ClientRouter;
	dispatcher: AbstractMessageDispatcher;
}

async function waitForConnection(clientRouter: ClientRouter): Promise<void> {
	const deadline = Date.now() + CONNECT_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (clientRouter.isReady() && clientRouter.isConnected()) return;
		await new Promise((r) => setTimeout(r, CONNECT_POLL_MS));
	}
	throw new Error('MQTT connection timeout');
}

async function waitForLocalConnection(client: Client): Promise<void> {
	const deadline = Date.now() + CONNECT_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (client.isReady()) return;
		await new Promise((r) => setTimeout(r, CONNECT_POLL_MS));
	}
	throw new Error('Local connection timeout');
}

export async function connectDevice(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
): Promise<DeviceConnection> {
	const device = session.devices.find((d) => d.duid === duid);
	if (!device) throw new Error(`Device not found: ${duid}`);

	const clientRouter = new ClientRouter(logger, session.userData);
	clientRouter.registerDevice(duid, device.localKey, device.pv, undefined);
	clientRouter.registerMessageListener(new LoggingMessageListener(duid, logger));
	clientRouter.connect();
	await waitForConnection(clientRouter);

	const dispatcher = new MessageDispatcherFactory(clientRouter, logger).getMessageDispatcher(
		device.specs.protocol,
		device.specs.model,
	);

	if (local) {
		const info = await dispatcher.getNetworkInfo(duid);
		if (!info?.ip) throw new Error('Could not get device IP address for local connection');
		console.log(`Connecting locally to ${info.ip}...`);
		const localClient = clientRouter.registerClient(duid, info.ip);
		localClient.connect();
		await waitForLocalConnection(localClient);
	}

	console.log(`Connected via: ${local ? 'local network' : 'MQTT'} | dispatcher: ${dispatcher.dispatcherName}`);

	return { clientRouter, dispatcher };
}
