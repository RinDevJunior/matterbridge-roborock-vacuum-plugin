import { SeverityNumber } from '@opentelemetry/api-logs';
import type { AnsiLogger } from 'matterbridge/logger';
import { LogLevel } from 'matterbridge/logger';

import { PLUGIN_NAME, PLUGIN_VERSION } from '../settings.js';
import { FilterLogger } from './filterLogger.js';
import type { OtelLogBridge } from './otelLogBridge.js';

export class OtelLogger extends FilterLogger {
	constructor(
		delegate: AnsiLogger,
		private readonly bridge: OtelLogBridge,
		sanitizeSensitiveLogs = true,
	) {
		super(delegate, sanitizeSensitiveLogs);
	}

	public override log(level: LogLevel, message: string, ...parameters: unknown[]): void {
		super.log(level, message, ...parameters);
		this.emitToOtel(level, message, parameters);
	}

	private emitToOtel(level: LogLevel, message: string, parameters: unknown[]): void {
		const sanitizedMessage = this.sanitizeSensitiveLogs ? String(this.filterSensitive(message)) : message;
		const sanitizedParams = parameters.map((p) =>
			this.sanitizeSensitiveLogs ? String(this.filterSensitive(p)) : String(p),
		);

		const body =
			sanitizedParams.length > 0 ? `${sanitizedMessage} ${sanitizedParams.join(' ')}` : sanitizedMessage;

		this.bridge.logger.emit({
			severityNumber: toSeverityNumber(level),
			severityText: String(level),
			body,
			timestamp: new Date(),
			attributes: {
				'plugin.name': PLUGIN_NAME,
				'plugin.version': PLUGIN_VERSION,
			},
		});
	}
}

function toSeverityNumber(level: LogLevel): SeverityNumber {
	switch (level) {
		case LogLevel.DEBUG:
			return SeverityNumber.DEBUG;
		case LogLevel.INFO:
			return SeverityNumber.INFO;
		case LogLevel.NOTICE:
			return SeverityNumber.INFO2;
		case LogLevel.WARN:
			return SeverityNumber.WARN;
		case LogLevel.ERROR:
			return SeverityNumber.ERROR;
		default:
			return SeverityNumber.UNSPECIFIED;
	}
}
