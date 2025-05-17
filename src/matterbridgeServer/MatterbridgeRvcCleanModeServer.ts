import { ModeBase } from 'matterbridge/matter/clusters';
import { RvcCleanModeBehavior } from 'matterbridge/matter/behaviors';
import { MatterbridgeServer } from 'matterbridge';
import { BehaviorRoborock } from '../behaviors/BehaviorDeviceGeneric.js';

export class MatterbridgeRoborockCleanModeServer extends RvcCleanModeBehavior /* .with(RvcRunMode.Feature.OnOff)*/ {
  override initialize() {
    this.state.currentMode = 1; // RvcCleanMode.ModeTag.Vacuum
  }

  override async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error('***MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode:', newMode);

      const a187Device = this.agent.get(BehaviorRoborock).state.device;
      await a187Device.executeCommand('ChangeCleanMode', newMode);

      return {
        status: ModeBase.ModeChangeStatus.InvalidInMode,
        statusText: 'Invalid mode',
      };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    device.log.debug(`***MatterbridgeRvcCleanModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
