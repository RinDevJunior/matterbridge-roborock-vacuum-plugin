import { MaybePromise } from 'matterbridge/matter';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { ServiceAreaBehavior } from 'matterbridge/matter/behaviors';
import { MatterbridgeServer } from 'matterbridge';

export class MatterbridgeRoborockServiceAreaServer extends ServiceAreaBehavior {
  override initialize() {
    //
  }

  override selectAreas({ newAreas }: ServiceArea.SelectAreasRequest): MaybePromise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    for (const area of newAreas) {
      const supportedArea = this.state.supportedAreas.find((supportedArea) => supportedArea.areaId === area);
      if (!supportedArea) {
        device.log.error('MatterbridgeServiceAreaServer selectAreas called with unsupported area:', area);
        return {
          status: ServiceArea.SelectAreasStatus.UnsupportedArea,
          statusText: 'Unsupported areas',
        };
      }
    }
    // device.selectAreas({ newAreas });
    this.state.selectedAreas = newAreas;
    this.state.currentArea = newAreas[0];
    device.log.debug(`***MatterbridgeServiceAreaServer selectAreas called with: ${newAreas.map((area) => area.toString()).join(', ')}`);
    return {
      status: ServiceArea.SelectAreasStatus.Success,
      statusText: 'Succesfully selected new areas',
    };
  }
}
