import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmdConsumable, formatConsumableLines } from '../../cli/commands/consumable.js';
import { HELP_TEXT } from '../../cli/help.js';
import type { CliSession } from '../../cli/types.js';
import { RequestMessage } from '../../roborockCommunication/models/requestMessage.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

const mockConnectDevice = vi.fn();

vi.mock('../../cli/connection.js', () => ({
	connectDevice: (...args: unknown[]) => mockConnectDevice(...args),
}));

const FULL_V1_RESPONSE: Record<string, unknown> = {
	main_brush_work_time: 3600,
	side_brush_work_time: 7200,
	filter_work_time: 270000,
	filter_element_work_time: 0,
	sensor_dirty_time: 1800,
	strainer_work_times: 12,
	dust_collection_work_times: 7,
};

function findLine(lines: string[], key: string): string {
	const line = lines.find((entry) => entry.includes(`${key}:`));
	if (line === undefined) throw new Error(`No output line for ${key}`);
	return line;
}

function createSession(): CliSession {
	return asPartial<CliSession>({ email: 'test@example.com', devices: [] });
}

function createClientRouterStub() {
	return { disconnect: vi.fn().mockResolvedValue(undefined) };
}

function createV1DispatcherStub(response: unknown) {
	return {
		getConsumableStatus: vi.fn().mockResolvedValue(undefined),
		getCustomMessage: vi.fn().mockResolvedValue(response),
		resetFilterConsumable: vi.fn(),
		sendCustomMessage: vi.fn(),
	};
}

describe('formatConsumableLines', () => {
	it('should print every known field in order with the expected units for a full V1 response', () => {
		// Arrange
		const raw = FULL_V1_RESPONSE;

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		const keys = [
			'main_brush_work_time',
			'side_brush_work_time',
			'filter_work_time',
			'filter_element_work_time',
			'sensor_dirty_time',
			'strainer_work_times',
			'dust_collection_work_times',
		];
		const indices = keys.map((key) => lines.findIndex((entry) => entry.includes(`${key}:`)));
		expect(indices.every((index) => index >= 0)).toBe(true);
		expect(indices).toEqual([...indices].sort((a, b) => a - b));
		expect(findLine(lines, 'main_brush_work_time')).toMatch(/1\.0 h$/);
		expect(findLine(lines, 'side_brush_work_time')).toMatch(/2\.0 h$/);
		expect(findLine(lines, 'filter_work_time')).toContain('75.0 h used, 50% remaining (rated 150 h)');
		expect(findLine(lines, 'filter_element_work_time')).toMatch(/0\.0 h$/);
		expect(findLine(lines, 'sensor_dirty_time')).toMatch(/0\.5 h$/);
		expect(findLine(lines, 'strainer_work_times')).toMatch(/12 times$/);
		expect(findLine(lines, 'dust_collection_work_times')).toMatch(/7 times$/);
	});

	it('should show a percentage only on the filter line', () => {
		// Arrange
		const raw = FULL_V1_RESPONSE;

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(lines.filter((entry) => entry.includes('%'))).toHaveLength(1);
		expect(findLine(lines, 'filter_work_time')).toContain('%');
		for (const key of ['main_brush_work_time', 'side_brush_work_time', 'sensor_dirty_time']) {
			expect(findLine(lines, key)).not.toContain('%');
			expect(findLine(lines, key)).not.toContain('rated');
		}
	});

	it('should print strainer and dust collection as counts without an hour unit', () => {
		// Arrange
		const raw = FULL_V1_RESPONSE;

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'strainer_work_times')).not.toMatch(/\d h\b/);
		expect(findLine(lines, 'dust_collection_work_times')).not.toMatch(/\d h\b/);
	});

	it('should print "(not reported)" when a known field is missing', () => {
		// Arrange
		const raw: Record<string, unknown> = { ...FULL_V1_RESPONSE };
		delete raw['sensor_dirty_time'];

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'sensor_dirty_time')).toMatch(/\(not reported\)$/);
	});

	it('should print "(not reported)" when a known field is a non-number', () => {
		// Arrange
		const raw = { ...FULL_V1_RESPONSE, filter_work_time: 'abc' };

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'filter_work_time')).toMatch(/\(not reported\)$/);
	});

	it('should append an unknown numeric field as a raw value', () => {
		// Arrange
		const raw = { ...FULL_V1_RESPONSE, cleaning_brush_work_times: 5 };

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'cleaning_brush_work_times')).toMatch(/5 \(raw\)$/);
	});

	it('should ignore an unknown string field', () => {
		// Arrange
		const raw = { ...FULL_V1_RESPONSE, vendor_note: 'hello' };

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(lines.some((entry) => entry.includes('vendor_note'))).toBe(false);
	});

	it('should clamp the filter remaining percentage to 0% when the filter is over its rated life', () => {
		// Arrange
		const raw = { ...FULL_V1_RESPONSE, filter_work_time: 999999 };

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'filter_work_time')).toContain('0% remaining');
		expect(findLine(lines, 'filter_work_time')).not.toContain('-');
	});

	it('should round seconds to one decimal hour (5400 s -> 1.5 h)', () => {
		// Arrange
		const raw = { ...FULL_V1_RESPONSE, main_brush_work_time: 5400 };

		// Act
		const lines = formatConsumableLines(raw);

		// Assert
		expect(findLine(lines, 'main_brush_work_time')).toMatch(/1\.5 h$/);
	});
});

describe('cmdConsumable', () => {
	let logger: ReturnType<typeof createMockLogger>;
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		consoleLogSpy.mockRestore();
	});

	it('should request get_consumable once and print every formatted line for a V1 device', async () => {
		// Arrange
		const clientRouter = createClientRouterStub();
		const dispatcher = createV1DispatcherStub(FULL_V1_RESPONSE);
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

		// Act
		await cmdConsumable('duid-1', createSession(), logger);

		// Assert
		expect(dispatcher.getCustomMessage).toHaveBeenCalledTimes(1);
		const call = vi.mocked(dispatcher.getCustomMessage).mock.calls[0];
		expect(call[0]).toBe('duid-1');
		expect(call[1]).toBeInstanceOf(RequestMessage);
		expect(call[1]).toMatchObject({ method: 'get_consumable' });
		expect(consoleLogSpy).toHaveBeenCalledWith('Consumables for device duid-1:\n');
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('filter_work_time:'));
	});

	it('should never call a reset or send method while reading consumables', async () => {
		// Arrange
		const clientRouter = createClientRouterStub();
		const dispatcher = createV1DispatcherStub(FULL_V1_RESPONSE);
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

		// Act
		await cmdConsumable('duid-1', createSession(), logger);

		// Assert
		expect(dispatcher.resetFilterConsumable).not.toHaveBeenCalled();
		expect(dispatcher.sendCustomMessage).not.toHaveBeenCalled();
	});

	it('should disconnect the client on the success path', async () => {
		// Arrange
		const clientRouter = createClientRouterStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher: createV1DispatcherStub(FULL_V1_RESPONSE) });

		// Act
		await cmdConsumable('duid-1', createSession(), logger);

		// Assert
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should propagate the error and still disconnect when getCustomMessage rejects', async () => {
		// Arrange
		const clientRouter = createClientRouterStub();
		const dispatcher = createV1DispatcherStub(undefined);
		dispatcher.getCustomMessage.mockRejectedValue(new Error('device offline'));
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

		// Act
		const act = cmdConsumable('duid-1', createSession(), logger);

		// Assert
		await expect(act).rejects.toThrow('device offline');
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should print the V1-only message, skip the request, and still disconnect when the dispatcher has no getConsumableStatus', async () => {
		// Arrange
		const clientRouter = createClientRouterStub();
		const dispatcher = { getCustomMessage: vi.fn() };
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher });

		// Act
		await cmdConsumable('duid-b01', createSession(), logger);

		// Assert
		expect(consoleLogSpy).toHaveBeenCalledWith('Consumables are only available on V1 (non-B01) devices.');
		expect(dispatcher.getCustomMessage).not.toHaveBeenCalled();
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});

	it.each([
		{ name: 'undefined', response: undefined },
		{ name: 'null', response: null },
		{ name: 'a string', response: 'oops' },
		{ name: 'a number', response: 42 },
	])('should print "No consumable data received." when the response is $name', async ({ response }) => {
		// Arrange
		const clientRouter = createClientRouterStub();
		mockConnectDevice.mockResolvedValue({ clientRouter, dispatcher: createV1DispatcherStub(response) });

		// Act
		await cmdConsumable('duid-1', createSession(), logger);

		// Assert
		expect(consoleLogSpy).toHaveBeenCalledWith('No consumable data received.');
		expect(clientRouter.disconnect).toHaveBeenCalledTimes(1);
	});
});

describe('HELP_TEXT consumable entry', () => {
	it('should include the consumable row and its example', () => {
		// Arrange
		const helpText = HELP_TEXT;

		// Act
		const occurrences = helpText.split('consumable').length - 1;

		// Assert
		expect(helpText).toContain('consumable');
		expect(helpText).toContain('Show consumables (brushes, filter, sensors) and their usage');
		expect(occurrences).toBeGreaterThanOrEqual(2);
	});
});
