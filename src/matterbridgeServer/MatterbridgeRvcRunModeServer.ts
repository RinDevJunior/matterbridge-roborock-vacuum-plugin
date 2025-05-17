import { MatterbridgeServer } from 'matterbridge';
import { RvcRunModeBehavior } from 'matterbridge/matter/behaviors';
import { MatterbridgeRoborockOperationalStateServer, MatterbridgeRoborockServiceAreaServer } from './index.js';
import { BehaviorRoborock } from '../behaviors/BehaviorDeviceGeneric.js';
import { ModeBase, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';

export class MatterbridgeRoborockRunModeServer extends RvcRunModeBehavior /* .with(RvcRunMode.Feature.OnOff)*/ {
  override initialize() {
    this.state.currentMode = 1; // RvcRunMode.ModeTag.Idle
  }

  override async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const changedMode = this.state.supportedModes.find((mode) => mode.mode === newMode);
    const a187Device = this.agent.get(BehaviorRoborock).state.device;
    if (!changedMode) {
      device.log.error('MatterbridgeRvcRunModeServer changeToRunMode called with unsupported newMode:', newMode);
      return {
        status: ModeBase.ModeChangeStatus.InvalidInMode,
        statusText: 'Invalid mode',
      };
    }

    if (!a187Device) {
      device.log.error('Can not send message to device');
    }

    device.log.debug(`MatterbridgeRvcRunModeServer changeToRunMode called with newMode: ${changedMode.label} codeNum: ${newMode}`);
    device.changeToMode({ newMode });

    this.state.currentMode = newMode;
    if (changedMode.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Cleaning)) {
      // Update the Cleaning
      this.agent.get(MatterbridgeRoborockOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
      const supportedAreas = this.agent.get(MatterbridgeRoborockServiceAreaServer).state.supportedAreas;
      let selectedAreas = this.agent.get(MatterbridgeRoborockServiceAreaServer).state.selectedAreas;

      if (supportedAreas.length === selectedAreas.length) {
        selectedAreas = [];
      }

      device.log.debug(`MatterbridgeRvcRunModeServer executeCommand ChangeRunMode newMode: ${newMode} selectedAreas: ${selectedAreas}`);
      await a187Device.executeCommand('ChangeRunMode', { newMode, selectedAreas });

      device.log.debug('***MatterbridgeRvcRunModeServer executeCommand ChangeRunMode completed');

      return {
        status: ModeBase.ModeChangeStatus.Success,
        statusText: 'Running',
      };
    }

    // Go to Docked
    else if (changedMode.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Idle)) {
      device.log.debug('***MatterbridgeRvcRunModeServer changeToRunMode called with newMode Idle => Docked');
      this.agent.get(MatterbridgeRoborockOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Docked;
      return {
        status: ModeBase.ModeChangeStatus.Success,
        statusText: 'Docked',
      };
    }
    device.log.debug(`***MatterbridgeRvcRunModeServer changeToRunMode called with newMode ${newMode} => ${changedMode.label}`);
    this.agent.get(MatterbridgeRoborockOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
