import { SeverityNumber } from '@opentelemetry/api-logs';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OtelLogger } from '../../share/otelLogger.js';
import type { OtelLogBridge } from '../../share/otelLogBridge.js';
import { createMockLogger } from '../helpers/testUtils.js';

function makeMockBridge(): OtelLogBridge {
	const emit = vi.fn();
	return {
		logger: { emit } as unknown as OtelLogBridge['logger'],
		shutdown: vi.fn().mockResolvedValue(undefined),
	} as unknown as OtelLogBridge;
}

function makeOtelLogger(bridge: OtelLogBridge, sanitize = true): { otelLogger: OtelLogger; delegate: AnsiLogger } {
	const delegate = createMockLogger();
	delegate.log = vi.fn((level: LogLevel, message: string, ...parameters: unknown[]) => {
		switch (level) {
			case LogLevel.DEBUG:
				delegate.debug(message, ...parameters);
				break;
			case LogLevel.INFO:
				delegate.info(message, ...parameters);
				break;
			case LogLevel.WARN:
				delegate.warn(message, ...parameters);
				break;
			case LogLevel.ERROR:
				delegate.error(message, ...parameters);
				break;
			case LogLevel.NOTICE:
				delegate.notice(message, ...parameters);
				break;
		}
	});
	const otelLogger = new OtelLogger(delegate, bridge, sanitize);
	return { otelLogger, delegate };
}

describe('OtelLogger', () => {
	let bridge: OtelLogBridge;

	beforeEach(() => {
		bridge = makeMockBridge();
	});

	describe('console output passthrough', () => {
		it('should still call delegate for INFO', () => {
			const { otelLogger, delegate } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'hello');
			expect(delegate.info).toHaveBeenCalledTimes(1);
		});

		it('should still call delegate for WARN', () => {
			const { otelLogger, delegate } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.WARN, 'warning');
			expect(delegate.warn).toHaveBeenCalledTimes(1);
		});

		it('should still call delegate for ERROR', () => {
			const { otelLogger, delegate } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.ERROR, 'error msg');
			expect(delegate.error).toHaveBeenCalledTimes(1);
		});

		it('should still call delegate for DEBUG', () => {
			const { otelLogger, delegate } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.DEBUG, 'debug msg');
			expect(delegate.debug).toHaveBeenCalledTimes(1);
		});

		it('should still call delegate for NOTICE', () => {
			const { otelLogger, delegate } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.NOTICE, 'notice msg');
			expect(delegate.notice).toHaveBeenCalledTimes(1);
		});
	});

	describe('OTel emit severity mapping', () => {
		it('should map DEBUG to SeverityNumber.DEBUG', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.DEBUG, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ severityNumber: SeverityNumber.DEBUG }),
			);
		});

		it('should map INFO to SeverityNumber.INFO', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ severityNumber: SeverityNumber.INFO }),
			);
		});

		it('should map NOTICE to SeverityNumber.INFO2', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.NOTICE, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ severityNumber: SeverityNumber.INFO2 }),
			);
		});

		it('should map WARN to SeverityNumber.WARN', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.WARN, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ severityNumber: SeverityNumber.WARN }),
			);
		});

		it('should map ERROR to SeverityNumber.ERROR', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.ERROR, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ severityNumber: SeverityNumber.ERROR }),
			);
		});
	});

	describe('OTel emit body', () => {
		it('should emit body as the log message when no parameters', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'hello world');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ body: 'hello world' }),
			);
		});

		it('should append parameters to body', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'device:', 'duid-123');
			const emitted = vi.mocked(bridge.logger.emit).mock.calls[0][0];
			expect(String(emitted.body)).toContain('device:');
			expect(String(emitted.body)).toContain('duid-123');
		});

		it('should include plugin.name attribute', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({
					attributes: expect.objectContaining({ 'plugin.name': expect.any(String) }),
				}),
			);
		});

		it('should include plugin.version attribute', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'msg');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({
					attributes: expect.objectContaining({ 'plugin.version': expect.any(String) }),
				}),
			);
		});
	});

	describe('sensitive data scrubbing', () => {
		it('should redact tokens before emitting to OTel', () => {
			const { otelLogger } = makeOtelLogger(bridge, true);
			const token = 'rr66ed372dc7f130:Z280JwKBBROBGNxs7Mclyg==:019bbefff10a7053b338ca65df32c84b';
			otelLogger.log(LogLevel.INFO, `token=${token}`);
			const emitted = vi.mocked(bridge.logger.emit).mock.calls[0][0];
			expect(String(emitted.body)).not.toContain(token);
			expect(String(emitted.body)).toContain('[TOKEN_REDACTED]');
		});

		it('should not redact when sanitizeSensitiveLogs is false', () => {
			const { otelLogger } = makeOtelLogger(bridge, false);
			otelLogger.log(LogLevel.INFO, 'plain text');
			expect(vi.mocked(bridge.logger.emit)).toHaveBeenCalledWith(
				expect.objectContaining({ body: 'plain text' }),
			);
		});
	});

	describe('OTel emit timestamp', () => {
		it('should include a timestamp', () => {
			const { otelLogger } = makeOtelLogger(bridge);
			otelLogger.log(LogLevel.INFO, 'msg');
			const emitted = vi.mocked(bridge.logger.emit).mock.calls[0][0];
			expect(emitted.timestamp).toBeDefined();
		});
	});
});
