import { MatterbridgeServer } from 'matterbridge';
import { RvcOperationalStateBehavior } from 'matterbridge/matter/behaviors';
import { MatterbridgeRoborockRunModeServer } from './MatterbridgeRvcRunModeServer.js';
import { BehaviorRoborock } from '../behaviors/BehaviorDeviceGeneric.js';
import { OperationalState, RvcOperationalState } from 'matterbridge/matter/clusters';

export class MatterbridgeRoborockOperationalStateServer extends RvcOperationalStateBehavior {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('***MatterbridgeRvcOperationalStateServer initialized: setting operational state to Docked');
    this.state.operationalState = RvcOperationalState.OperationalState.Docked;
    this.state.operationalError = {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Error',
      errorStateDetails: 'Fully operational',
    };
  }

  override async pause(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;

    device.log.debug('MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle');
    const a187Device = this.agent.get(BehaviorRoborock).state.device;
    await a187Device.executeCommand('Pause');

    this.agent.get(MatterbridgeRoborockRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Paused;
    this.state.operationalError = {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Error',
      errorStateDetails: 'Fully operational',
    };
    return {
      commandResponseState: {
        errorStateId: OperationalState.ErrorState.NoError,
        errorStateLabel: 'No error',
        errorStateDetails: 'Fully operational',
      },
    } as OperationalState.OperationalCommandResponse;
  }

  override async resume(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning');
    const a187Device = this.agent.get(BehaviorRoborock).state.device;
    await a187Device.executeCommand('Resume');

    this.agent.get(MatterbridgeRoborockRunModeServer).state.currentMode = 2; // RvcRunMode.ModeTag.Cleaning
    this.state.operationalState = RvcOperationalState.OperationalState.Running;
    this.state.operationalError = {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Error',
      errorStateDetails: 'Fully operational',
    };
    return {
      commandResponseState: {
        errorStateId: OperationalState.ErrorState.NoError,
        errorStateLabel: 'No error',
        errorStateDetails: 'Fully operational',
      },
    } as OperationalState.OperationalCommandResponse;
  }

  override async goHome(): Promise<OperationalState.OperationalCommandResponse> {
    // const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle');
    const a187Device = this.agent.get(BehaviorRoborock).state.device;
    await a187Device.executeCommand('GoHome');

    this.agent.get(MatterbridgeRoborockRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Docked;
    this.state.operationalError = {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Error',
      errorStateDetails: 'Fully operational',
    };
    return {
      commandResponseState: {
        errorStateId: OperationalState.ErrorState.NoError,
        errorStateLabel: 'No error',
        errorStateDetails: 'Fully operational',
      },
    } as OperationalState.OperationalCommandResponse;
  }
}
