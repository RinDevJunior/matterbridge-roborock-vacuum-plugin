import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { getAllKnownModeConfigs } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';

const allKnownModeConfigs = getAllKnownModeConfigs();

export function getRunModeName(runMode: number): string {
  return (
    Object.keys(RvcRunMode.ModeTag).find(
      (key) => RvcRunMode.ModeTag[key as keyof typeof RvcRunMode.ModeTag] === runMode,
    ) || String(runMode)
  );
}

export function getOperationalStateName(operationalState: number): string {
  return (
    Object.keys(RvcOperationalState.OperationalState).find(
      (key) =>
        RvcOperationalState.OperationalState[key as keyof typeof RvcOperationalState.OperationalState] ===
        operationalState,
    ) || String(operationalState)
  );
}

export function getCleanModeName(mode: number): string {
  return allKnownModeConfigs.find((x) => x.mode === mode)?.label ?? 'Not found';
}

export function getOperationalErrorName(operationalError: number): string {
  return (
    Object.keys(RvcOperationalState.ErrorState).find(
      (key) => RvcOperationalState.ErrorState[key as keyof typeof RvcOperationalState.ErrorState] === operationalError,
    ) || String(operationalError)
  );
}
