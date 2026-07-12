import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockServiceAreaServer } from '../../behaviors/roborockServiceAreaServer.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger, setReadOnlyProperty } from '../helpers/testUtils.js';

function createMockDevice(overrides: Partial<RoborockVacuumCleaner> = {}): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		log: createMockLogger(),
		getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Running),
		updateAttribute: vi.fn().mockResolvedValue(true),
		skipAreaHandler: vi.fn().mockResolvedValue(undefined),
		finalizeSkipArea: vi.fn().mockResolvedValue({
			updatedProgress: [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Completed },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Skipped },
				{ areaId: 3, status: ServiceArea.OperationalStatus.Operating },
			],
			nextAreaId: 3,
		}),
		resolveAllRoomsForActiveMap: vi.fn().mockReturnValue([]),
		trySwitchMap: vi.fn().mockResolvedValue(undefined),
		stateOf: vi.fn().mockReturnValue({} as any),
		...overrides,
	});
}

function createServer(
	state: {
		selectedAreas: number[];
		currentArea?: number | null;
		progress?: ServiceArea.Progress[];
		supportedAreas?: ServiceArea.Area[];
	},
	device: RoborockVacuumCleaner,
): RoborockServiceAreaServer {
	const server = Object.create(RoborockServiceAreaServer.prototype) as RoborockServiceAreaServer;
	setReadOnlyProperty(server, 'state', {
		selectedAreas: state.selectedAreas,
		currentArea: state.currentArea ?? null,
		progress: state.progress ?? [],
		supportedAreas: state.supportedAreas ?? [],
	});
	setReadOnlyProperty(server, 'endpoint', device);
	setReadOnlyProperty(server, 'log', device.log);
	return server;
}

describe('RoborockServiceAreaServer', () => {
	let device: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		device = createMockDevice();
	});

	describe('selectAreas', () => {
		it('should call resolveAllRoomsForActiveMap when empty input provided', async () => {
			vi.mocked(device.resolveAllRoomsForActiveMap).mockReturnValue([1, 2]);
			const server = createServer({ selectedAreas: [] }, device);

			// Spy on super.selectAreas to verify it's called with resolved areas
			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas({ newAreas: [] });

			expect(vi.mocked(device.resolveAllRoomsForActiveMap)).toHaveBeenCalled();
			expect(superSelectAreasSpy).toHaveBeenCalledWith({ newAreas: [1, 2] });
		});

		it('should clear selectedAreas when empty input resolves to empty list', async () => {
			vi.mocked(device.resolveAllRoomsForActiveMap).mockReturnValue([]);
			const server = createServer({ selectedAreas: [1, 2] }, device);

			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas({ newAreas: [] });

			expect(vi.mocked(device.log.info)).toHaveBeenCalledWith(
				'Clearing selected areas (global cleaning on next start)',
			);
			expect(superSelectAreasSpy).toHaveBeenCalledWith({ newAreas: [] });
		});

		it('should not call trySwitchMap on empty input path regardless of activeMapId', async () => {
			vi.mocked(device.resolveAllRoomsForActiveMap).mockReturnValue([1, 2]);
			const server = createServer({ selectedAreas: [] }, device);

			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas({ newAreas: [] });

			expect(vi.mocked(device.trySwitchMap)).not.toHaveBeenCalled();
		});

		it('should log populate message when empty input resolves to non-empty list', async () => {
			vi.mocked(device.resolveAllRoomsForActiveMap).mockReturnValue([1, 2]);
			const server = createServer({ selectedAreas: [] }, device);

			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas({ newAreas: [] });

			expect(vi.mocked(device.log.info)).toHaveBeenCalledWith(
				'Populating selected areas with all rooms of active map for global cleaning: 1, 2',
			);
		});

		it('should call trySwitchMap for non-empty input', async () => {
			const server = createServer({ selectedAreas: [] }, device);

			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas({ newAreas: [3] });

			expect(vi.mocked(device.trySwitchMap)).toHaveBeenCalledWith([3]);
			expect(vi.mocked(device.resolveAllRoomsForActiveMap)).not.toHaveBeenCalled();
			expect(superSelectAreasSpy).toHaveBeenCalledWith({ newAreas: [3] });
		});

		it('should forward original request to super for non-empty input', async () => {
			const originalRequest = { newAreas: [1, 2] };
			const server = createServer({ selectedAreas: [] }, device);

			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas(originalRequest);

			// Verify the original request object is passed unchanged
			expect(superSelectAreasSpy).toHaveBeenCalledWith(originalRequest);
			expect(vi.mocked(device.resolveAllRoomsForActiveMap)).not.toHaveBeenCalled();
		});
	});

	describe('skipArea', () => {
		it('should return InvalidInMode when operational state is Docked', async () => {
			vi.mocked(device.getAttribute).mockReturnValue(RvcOperationalState.OperationalState.Docked);
			const server = createServer({ selectedAreas: [1, 2], currentArea: 1 }, device);

			const response = await server.skipArea({ skippedArea: 1 });

			expect(response.status).toBe(ServiceArea.SkipAreaStatus.InvalidInMode);
			expect(device.skipAreaHandler).not.toHaveBeenCalled();
		});

		it('should return InvalidInMode when operational state is Stopped', async () => {
			vi.mocked(device.getAttribute).mockReturnValue(RvcOperationalState.OperationalState.Stopped);
			const server = createServer({ selectedAreas: [1, 2], currentArea: 1 }, device);

			const response = await server.skipArea({ skippedArea: 1 });

			expect(response.status).toBe(ServiceArea.SkipAreaStatus.InvalidInMode);
		});

		it('should return InvalidAreaList when selectedAreas is empty', async () => {
			const server = createServer({ selectedAreas: [] }, device);

			const response = await server.skipArea({ skippedArea: 1 });

			expect(response.status).toBe(ServiceArea.SkipAreaStatus.InvalidAreaList);
		});

		it('should return InvalidSkippedArea when skippedArea is not in selectedAreas', async () => {
			const server = createServer({ selectedAreas: [1, 2], currentArea: 1 }, device);

			const response = await server.skipArea({ skippedArea: 99 });

			expect(response.status).toBe(ServiceArea.SkipAreaStatus.InvalidSkippedArea);
		});

		it('should call skipAreaHandler and advance progress on success', async () => {
			const server = createServer(
				{
					selectedAreas: [1, 2, 3],
					currentArea: 2,
					progress: [
						{ areaId: 1, status: ServiceArea.OperationalStatus.Completed },
						{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
						{ areaId: 3, status: ServiceArea.OperationalStatus.Pending },
					],
				},
				device,
			);

			const response = await server.skipArea({ skippedArea: 2 });

			expect(response.status).toBe(ServiceArea.SkipAreaStatus.Success);
			expect(device.skipAreaHandler).toHaveBeenCalledWith(2);
			expect(device.finalizeSkipArea).toHaveBeenCalledWith(2);
		});
	});
});
