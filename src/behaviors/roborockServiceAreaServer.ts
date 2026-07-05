import { MatterbridgeServiceAreaServer } from 'matterbridge';
import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';

import type { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

const SKIP_ALLOWED_OPERATIONAL_STATES = new Set<RvcOperationalState.OperationalState>([
	RvcOperationalState.OperationalState.Running,
	RvcOperationalState.OperationalState.Paused,
]);

export class RoborockServiceAreaServer extends MatterbridgeServiceAreaServer {
	override async skipArea(request: ServiceArea.SkipAreaRequest): Promise<ServiceArea.SkipAreaResponse> {
		const device = this.endpoint as unknown as RoborockVacuumCleaner;
		const { skippedArea } = request;
		const selectedAreas = this.state.selectedAreas;

		if (selectedAreas.length === 0) {
			return { status: ServiceArea.SkipAreaStatus.InvalidAreaList, statusText: '' };
		}

		if (!selectedAreas.includes(skippedArea)) {
			return {
				status: ServiceArea.SkipAreaStatus.InvalidSkippedArea,
				statusText: `AreaID ${skippedArea} is not in the selected areas list`,
			};
		}

		const operationalState = device.getAttribute(
			RvcOperationalState.id,
			'operationalState',
			device.log,
		) as RvcOperationalState.OperationalState;

		if (!SKIP_ALLOWED_OPERATIONAL_STATES.has(operationalState)) {
			return { status: ServiceArea.SkipAreaStatus.InvalidInMode, statusText: '' };
		}

		const currentArea = this.state.currentArea ?? null;
		const progress = (device.getAttribute(ServiceArea.id, 'progress', device.log) ?? []) as ServiceArea.Progress[];
		if (currentArea === null && progress.length === 0) {
			return { status: ServiceArea.SkipAreaStatus.InvalidInMode, statusText: '' };
		}

		if (!device.skipAreaHandler) {
			return { status: ServiceArea.SkipAreaStatus.InvalidInMode, statusText: '' };
		}

		try {
			await device.skipAreaHandler(skippedArea);
		} catch {
			return { status: ServiceArea.SkipAreaStatus.InvalidInMode, statusText: '' };
		}

		await device.finalizeSkipArea(skippedArea);

		return { status: ServiceArea.SkipAreaStatus.Success, statusText: '' };
	}
}
