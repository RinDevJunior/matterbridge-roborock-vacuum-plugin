import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/default/initalData.js';
import { VacuumErrorCode } from '../roborockCommunication/Zenum/vacuumAndDockErrorCode.js';

export function getOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
  return getDefaultOperationalStates();
}

export function getOperationalErrorState(errorCode: VacuumErrorCode): RvcOperationalState.OperationalState | undefined {
  switch (errorCode) {
    case VacuumErrorCode.None:
      return undefined;
    default: {
      return RvcOperationalState.OperationalState.Error;
    }
  }
}
