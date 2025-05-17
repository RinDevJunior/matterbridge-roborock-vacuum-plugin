import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getOperationalStatesA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/initalData.js';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export function getOperationalStates(model: string): RvcOperationalState.OperationalStateStruct[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getOperationalStatesA187();
    default:
      return getDefaultOperationalStates();
  }
}
