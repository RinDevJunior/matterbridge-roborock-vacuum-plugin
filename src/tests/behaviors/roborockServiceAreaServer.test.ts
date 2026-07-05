import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoborockServiceAreaServer } from '../../behaviors/roborockServiceAreaServer.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger, setReadOnlyProperty } from '../helpers/testUtils.js';

function createMockDevice(overrides: Partial<RoborockVacuumCleaner> = {}): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		log: createMockLogger(),
		getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Running),
		skipAreaHandler: vi.fn().mockResolvedValue(undefined),
		finalizeSkipArea: vi.fn().mockResolvedValue({
			updatedProgress: [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Completed },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Skipped },
				{ areaId: 3, status: ServiceArea.OperationalStatus.Operating },
			],
			nextAreaId: 3,
		}),
		...overrides,
	});
}

function createServer(
	state: {
		selectedAreas: number[];
		currentArea?: number | null;
		progress?: ServiceArea.Progress[];
	},
	device: RoborockVacuumCleaner,
): RoborockServiceAreaServer {
	const server = Object.create(RoborockServiceAreaServer.prototype) as RoborockServiceAreaServer;
	setReadOnlyProperty(server, 'state', {
		selectedAreas: state.selectedAreas,
		currentArea: state.currentArea ?? null,
		progress: state.progress ?? [],
	});
	setReadOnlyProperty(server, 'endpoint', device);
	return server;
}

describe('RoborockServiceAreaServer', () => {
	let device: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		device = createMockDevice();
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
