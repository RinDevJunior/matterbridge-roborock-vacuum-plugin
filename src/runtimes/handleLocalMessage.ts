import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { RoborockMatterbridgePlatform } from '../module.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

/**
 * Trigger docking station status error if conditions are met.
 * Checks current operational state and updates to Error state if appropriate.
 */
export function triggerDssError(robot: RoborockVacuumCleaner, platform: RoborockMatterbridgePlatform): boolean {
  const currentOperationState = robot.getAttribute(
    RvcOperationalState.Cluster.id,
    'operationalState',
  ) as RvcOperationalState.OperationalState;
  if (currentOperationState === RvcOperationalState.OperationalState.Error) {
    return true;
  }

  if (currentOperationState === RvcOperationalState.OperationalState.Docked) {
    robot.updateAttribute(
      RvcOperationalState.Cluster.id,
      'operationalState',
      RvcOperationalState.OperationalState.Error,
      platform.log,
    );
    return true;
  }

  return false;
}
