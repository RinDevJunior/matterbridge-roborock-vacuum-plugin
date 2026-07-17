import { RvcOperationalState } from 'matterbridge/matter/clusters';

import { DockErrorCode } from '../roborockCommunication/enums/vacuumAndDockErrorCode.js';

export enum DockStationStatusCode {
	Unknown = 0,
	Error = 1,
	OK = 2,
}

/**
 * Bit layout of docking station status value:
 * - Bits 0-1:   isUpdownWaterReady
 * - Bits 2-3:   clearWaterBoxStatus
 * - Bits 4-5:   dirtyWaterBoxStatus
 * - Bits 6-7:   dustBagStatus
 * - Bits 8-9:   waterBoxFilterStatus
 * - Bits 10-11: cleanFluidStatus
 */

const BIT_MASK_2BITS = 0b11;

const BitPosition = {
	IsUpdownWaterReady: 0,
	ClearWaterBox: 2,
	DirtyWaterBox: 4,
	DustBag: 6,
	WaterBoxFilter: 8,
	CleanFluid: 10,
} as const;

function extractBits(value: number, position: number): number {
	return (value >> position) & BIT_MASK_2BITS;
}

const DOCK_ERROR_TO_MATTER: ReadonlyMap<DockErrorCode, RvcOperationalState.ErrorState> = new Map([
	[DockErrorCode.None, RvcOperationalState.ErrorState.NoError],
	[DockErrorCode.NoDustbinOrFilter, RvcOperationalState.ErrorState.DustBinMissing],
	[DockErrorCode.AutoEmptyDockFanError, RvcOperationalState.ErrorState.DustBinFull],
	[DockErrorCode.AutoEmptyDockVoltageError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[DockErrorCode.DuctBlockage, RvcOperationalState.ErrorState.DustBinFull],
	[DockErrorCode.WaterEmpty, RvcOperationalState.ErrorState.WaterTankEmpty],
	[DockErrorCode.WasteWaterTankFull, RvcOperationalState.ErrorState.DirtyWaterTankFull],
	[DockErrorCode.CleaningTankFullOrBlocked, RvcOperationalState.ErrorState.DirtyWaterTankFull],
	[DockErrorCode.MaintenanceBrushJammed, RvcOperationalState.ErrorState.BrushJammed],
	[DockErrorCode.DirtyTankLatchOpen, RvcOperationalState.ErrorState.DirtyWaterTankMissing],
	[DockErrorCode.NoDustbin, RvcOperationalState.ErrorState.DustBinMissing],
]);

type DssFieldKey =
	| 'clearWaterBoxStatus'
	| 'dirtyWaterBoxStatus'
	| 'dustBagStatus'
	| 'cleanFluidStatus'
	| 'waterBoxFilterStatus'
	| 'isUpdownWaterReady';

const DSS_FIELD_PRIORITY: readonly {
	field: DssFieldKey;
	errorState: RvcOperationalState.ErrorState;
}[] = [
	{ field: 'clearWaterBoxStatus', errorState: RvcOperationalState.ErrorState.WaterTankEmpty },
	{ field: 'dirtyWaterBoxStatus', errorState: RvcOperationalState.ErrorState.DirtyWaterTankFull },
	{ field: 'dustBagStatus', errorState: RvcOperationalState.ErrorState.DustBinMissing },
	{ field: 'cleanFluidStatus', errorState: RvcOperationalState.ErrorState.WaterTankMissing },
	{ field: 'waterBoxFilterStatus', errorState: RvcOperationalState.ErrorState.WaterTankMissing },
	{ field: 'isUpdownWaterReady', errorState: RvcOperationalState.ErrorState.UnableToCompleteOperation },
];

export class DockStationStatus {
	constructor(
		public readonly cleanFluidStatus: DockStationStatusCode,
		public readonly waterBoxFilterStatus: DockStationStatusCode,
		public readonly dustBagStatus: DockStationStatusCode,
		public readonly dirtyWaterBoxStatus: DockStationStatusCode,
		public readonly clearWaterBoxStatus: DockStationStatusCode,
		public readonly isUpdownWaterReady: DockStationStatusCode,
	) {}

	public hasError(): boolean {
		return (
			this.cleanFluidStatus === DockStationStatusCode.Error ||
			this.waterBoxFilterStatus === DockStationStatusCode.Error ||
			this.dustBagStatus === DockStationStatusCode.Error ||
			this.dirtyWaterBoxStatus === DockStationStatusCode.Error ||
			this.clearWaterBoxStatus === DockStationStatusCode.Error ||
			this.isUpdownWaterReady === DockStationStatusCode.Error
		);
	}

	public getMatterOperationalError(): RvcOperationalState.ErrorState {
		for (const { field, errorState } of DSS_FIELD_PRIORITY) {
			if (this[field] === DockStationStatusCode.Error) {
				return errorState;
			}
		}

		return RvcOperationalState.ErrorState.NoError;
	}

	public static parseDockStationStatus(dss: number): DockStationStatus {
		return new DockStationStatus(
			extractBits(dss, BitPosition.CleanFluid),
			extractBits(dss, BitPosition.WaterBoxFilter),
			extractBits(dss, BitPosition.DustBag),
			extractBits(dss, BitPosition.DirtyWaterBox),
			extractBits(dss, BitPosition.ClearWaterBox),
			extractBits(dss, BitPosition.IsUpdownWaterReady),
		);
	}

	public static parseDockErrorCode(dockErrorCode: DockErrorCode): RvcOperationalState.ErrorState {
		return DOCK_ERROR_TO_MATTER.get(dockErrorCode) ?? RvcOperationalState.ErrorState.UnableToCompleteOperation;
	}
}
