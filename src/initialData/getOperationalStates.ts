import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getOperationalStatesA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/initalData.js';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { VacuumErrorCode } from '../roborockCommunication/Zenum/vacuumAndDockErrorCode.js';
import { getOperationalStatesA27 } from '../behaviors/roborock.vacuum/S7_MAXV/initalData.js';

export function getOperationalStates(model: string): RvcOperationalState.OperationalStateStruct[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getOperationalStatesA187();
    case DeviceModel.S7_MAXV:
      return getOperationalStatesA27();
    default:
      return getDefaultOperationalStates();
  }
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
