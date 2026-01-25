import { Q7MopRoute, Q7MopWaterFlow, Q7VacuumSuctionPower } from '../../behaviors/roborock.vacuum/b01/q7.js';

export function resolveVacuumMode(suctionPower: number): number {
  switch (suctionPower) {
    case Q7VacuumSuctionPower.Quiet:
      return 1;
    case Q7VacuumSuctionPower.Balanced:
      return 2;
    case Q7VacuumSuctionPower.Turbo:
      return 3;
    case Q7VacuumSuctionPower.Max:
      return 4;
    case Q7VacuumSuctionPower.MaxPlus:
      return 5;
    default:
      return 0;
  }
}

export function resolveMopMode(waterFlow: number): number {
  switch (waterFlow) {
    case Q7MopWaterFlow.High:
      return 3;
    case Q7MopWaterFlow.Medium:
      return 2;
    case Q7MopWaterFlow.Low:
      return 1;
    default:
      return 0;
  }
}

export function resolveCleanRoute(mopRoute: number): number {
  switch (mopRoute) {
    case Q7MopRoute.Standard:
      return 0;
    case Q7MopRoute.Deep:
      return 1;
    default:
      return 0;
  }
}

export function resolveQ7CleanMode(suctionPower: number, waterFlow: number): number {
  // vacuum only, return 0,
  // mop only return 2,
  // vacuum + mop return 1
  const isVacuum = suctionPower !== Q7VacuumSuctionPower.Off;
  const isMop = waterFlow !== Q7MopWaterFlow.Off;

  if (isVacuum && isMop) {
    return 1;
  } else if (isVacuum) {
    return 0;
  } else if (isMop) {
    return 2;
  } else {
    return 1; // default to vacuum + mop
  }
}

export function resolveQ10CleanMode(suctionPower: number, waterFlow: number): number {
  // mop only, return 3,
  // vacuum only return 2,
  // vacuum + mop return 1
  const isVacuum = suctionPower !== 0;
  const isMop = waterFlow !== 0;

  if (isVacuum && isMop) {
    return 1;
  } else if (isVacuum) {
    return 2;
  } else if (isMop) {
    return 3;
  } else {
    return 1; // default to vacuum + mop
  }
}

export function resolveMopModeWithDistanceOff(waterFlow: number, distance_off: number): number {
  if (distance_off > 0) {
    return 4; // Customize with distance off
  }

  return resolveMopMode(waterFlow);
}
