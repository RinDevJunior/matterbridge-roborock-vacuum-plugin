import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import type { Logger } from '@opentelemetry/api-logs';

import type { LokiSettings } from '../model/RoborockPluginPlatformConfig.js';
import { PLUGIN_NAME, PLUGIN_VERSION } from '../settings.js';

class OtelLogBridge {
	readonly logger: Logger;
	private readonly loggerProvider: LoggerProvider;

	constructor(settings: LokiSettings) {
		const exporter = new OTLPLogExporter({
			url: `${settings.lokiEndpoint}/otlp/v1/logs`,
		});

		this.loggerProvider = new LoggerProvider({
			resource: resourceFromAttributes({
				'service.name': settings.serviceName ?? PLUGIN_NAME,
				'service.version': PLUGIN_VERSION,
			}),
			processors: [new BatchLogRecordProcessor(exporter)],
		});

		this.logger = this.loggerProvider.getLogger(PLUGIN_NAME, PLUGIN_VERSION);
	}

	async shutdown(): Promise<void> {
		await this.loggerProvider.shutdown();
	}
}

let instance: OtelLogBridge | undefined;

export function initOtelLogBridge(settings: LokiSettings): OtelLogBridge {
	instance ??= new OtelLogBridge(settings);
	return instance;
}

export async function shutdownOtelLogBridge(): Promise<void> {
	await instance?.shutdown();
	instance = undefined;
}

export type { OtelLogBridge };
