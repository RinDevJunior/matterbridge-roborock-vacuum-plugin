import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockServiceAreaServer } from '../../behaviors/roborockServiceAreaServer.js';
import { Device } from '../../roborockCommunication/models/index.js';
import { RoborockService } from '../../services/roborockService.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger, setReadOnlyProperty } from '../helpers/testUtils.js';

function createMockDevice(): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: 'test-duid' }),
		roborockService: asPartial<RoborockService>({ setProgress: vi.fn() }),
		log: createMockLogger(),
		getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Running),
		updateAttribute: vi.fn().mockResolvedValue(true),
		finalizeSkipArea: vi.fn().mockResolvedValue({ updatedProgress: [], nextAreaId: null }),
		resolveAllRoomsForActiveMap: vi.fn().mockReturnValue([]),
		trySwitchMap: vi.fn().mockResolvedValue(undefined),
	});
}

function createServer(
	state: { selectedAreas: number[]; currentArea?: number | null; progress?: ServiceArea.Progress[] },
	device: RoborockVacuumCleaner,
): RoborockServiceAreaServer {
	const server = Object.create(RoborockServiceAreaServer.prototype) as RoborockServiceAreaServer;
	setReadOnlyProperty(server, 'state', {
		selectedAreas: state.selectedAreas,
		currentArea: state.currentArea ?? null,
		progress: state.progress ?? [],
		supportedAreas: [],
	});
	setReadOnlyProperty(server, 'endpoint', device);
	setReadOnlyProperty(server, 'log', device.log);
	return server;
}

describe('RoborockServiceAreaServer gap coverage', () => {
	let device: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		device = createMockDevice();
	});

	describe('selectAreas', () => {
		it('should treat an undefined newAreas as empty and resolve all rooms of the active map', async () => {
			vi.mocked(device.resolveAllRoomsForActiveMap).mockReturnValue([1, 2]);
			const server = createServer({ selectedAreas: [] }, device);
			const superSelectAreasSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas');
			superSelectAreasSpy.mockResolvedValue({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });

			await server.selectAreas(asPartial<ServiceArea.SelectAreasRequest>({}));

			expect(device.resolveAllRoomsForActiveMap).toHaveBeenCalled();
			expect(device.trySwitchMap).not.toHaveBeenCalled();
			expect(superSelectAreasSpy).toHaveBeenCalledWith({ newAreas: [1, 2] });
		});
	});

	describe('skipArea', () => {
		it('should return InvalidInMode without calling super when progress is undefined and no current area exists', async () => {
			vi.mocked(device.getAttribute).mockImplementation(((_clusterId: number, attribute: string): unknown =>
				attribute === 'progress'
					? undefined
					: RvcOperationalState.OperationalState.Running) as RoborockVacuumCleaner['getAttribute']);
			const server = createServer({ selectedAreas: [1], currentArea: null }, device);
			const superSkipAreaSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'skipArea');

			const response = await server.skipArea(asPartial<ServiceArea.SkipAreaRequest>({ skippedArea: 1 }));

			expect(response).toEqual({ status: ServiceArea.SkipAreaStatus.InvalidInMode, statusText: '' });
			expect(superSkipAreaSpy).not.toHaveBeenCalled();
		});
	});
});
