import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

import { OperationStatusCode } from '../roborockCommunication/enums/index.js';

const matterStateMap = new Map<number, RvcRunMode.ModeTag>([
	[OperationStatusCode.RemoteControl, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.Cleaning, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ReturningDock, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ManualMode, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.SpotCleaning, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ReturnToDock, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.GoTo, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ZoneClean, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.RoomClean, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.WashingTheMop, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.GoingToWashTheMop, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.EmptyingDustContainer, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.Initiating, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.Paused, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.AirDryingStopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.CleanMopCleaning, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.CleanMopMopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.RoomMopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.RoomCleanMopCleaning, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.RoomCleanMopMopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ZoneMopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ZoneCleanMopCleaning, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.ZoneCleanMopMopping, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.BackToDockWashingDuster, RvcRunMode.ModeTag.Cleaning],
	[OperationStatusCode.Mapping, RvcRunMode.ModeTag.Mapping],
]);

const matterOperationalStatusMap = new Map<number, RvcOperationalState.OperationalState>([
	[OperationStatusCode.Initiating, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RemoteControl, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.Cleaning, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.ManualMode, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.SpotCleaning, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.GoTo, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.ZoneClean, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RoomClean, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.InCall, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.Mapping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.Patrol, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.CleanMopCleaning, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.CleanMopMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RoomMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RoomCleanMopCleaning, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RoomCleanMopMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.ZoneMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.ZoneCleanMopCleaning, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.ZoneCleanMopMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.RobotStatusMopping, RvcOperationalState.OperationalState.Running],
	[OperationStatusCode.InError, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.ChargingError, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.Unknown, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.DeviceOffline, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.Locked, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.AirDryingStopping, RvcOperationalState.OperationalState.Error],
	[OperationStatusCode.Paused, RvcOperationalState.OperationalState.Paused],
	[OperationStatusCode.ShuttingDown, RvcOperationalState.OperationalState.Stopped],
	[OperationStatusCode.ReturnToDock, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.ReturningDock, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.WashingTheMop, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.WashingTheMop2, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.GoingToWashTheMop, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.BackToDockWashingDuster, RvcOperationalState.OperationalState.SeekingCharger],
	[OperationStatusCode.EmptyingDustContainer, RvcOperationalState.OperationalState.SeekingCharger],
]);

export function state_to_matter_state(state: number): RvcRunMode.ModeTag | undefined {
	return matterStateMap.get(state) ?? RvcRunMode.ModeTag.Idle;
}

export function state_to_matter_operational_status(
	state: number | undefined,
): RvcOperationalState.OperationalState | undefined {
	if (state === undefined) {
		return undefined;
	}
	return matterOperationalStatusMap.get(state) ?? RvcOperationalState.OperationalState.Docked;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function asType<T>(v: unknown): T {
	return v as T;
}
