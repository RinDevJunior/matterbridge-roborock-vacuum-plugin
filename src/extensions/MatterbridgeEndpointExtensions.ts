import { MatterbridgeEndpoint } from 'matterbridge';
import { RvcRunMode, RvcOperationalState, RvcCleanMode, ServiceArea } from 'matterbridge/matter/clusters';
import {
  MatterbridgeRoborockCleanModeServer,
  MatterbridgeRoborockOperationalStateServer,
  MatterbridgeRoborockRunModeServer,
  MatterbridgeRoborockServiceAreaServer,
} from '../matterbridgeServer/index.js';
import { Behavior } from 'matterbridge/matter';
import { BehaviorDeviceGeneric, DeviceCommands } from '../behaviors/BehaviorDeviceGeneric.js';

declare module 'matterbridge' {
  interface MatterbridgeEndpoint {
    createDefaultRvcRunModeClusterServer(supportedRunModes?: RvcRunMode.ModeOption[], currentRunMode?: number): this;
    createDefaultRvcOperationalStateClusterServer(
      operationalStateList?: RvcOperationalState.OperationalStateStruct[],
      phaseList?: string[] | null,
      currentPhase?: number | null,
      operationalState?: RvcOperationalState.OperationalState,
      operationalError?: RvcOperationalState.ErrorStateStruct,
    ): this;
    createDefaultRvcCleanModeClusterServer(supportedCleanModes?: RvcCleanMode.ModeOption[], currentCleanMode?: number): this;
    createDefaultServiceAreaClusterServer(supportedAreas?: ServiceArea.Area[], selectedAreas?: number[], currentArea?: number): this;
    configurateBehaviorHandler<DC extends DeviceCommands, BH extends BehaviorDeviceGeneric<DC>, BC extends Behavior.Type>(behaviorClass: BC, deviceHandler: BH): this;
  }
}

MatterbridgeEndpoint.prototype.configurateBehaviorHandler = function <BC extends Behavior.Type, DC extends DeviceCommands, BH extends BehaviorDeviceGeneric<DC>>(
  behaviorClass: BC,
  deviceHandler: BH,
): MatterbridgeEndpoint {
  this.behaviors.require(behaviorClass, { device: deviceHandler } as any);
  return this;
};

MatterbridgeEndpoint.prototype.createDefaultRvcRunModeClusterServer = function (supportedRunModes?: RvcRunMode.ModeOption[], currentRunMode?: number): MatterbridgeEndpoint {
  this.behaviors.require(MatterbridgeRoborockRunModeServer, {
    supportedModes: supportedRunModes ?? [
      {
        label: 'Idle',
        mode: 1,
        modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
      },
      {
        label: 'Cleaning',
        mode: 2,
        modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
      },
      {
        label: 'Mapping',
        mode: 3,
        modeTags: [{ value: RvcRunMode.ModeTag.Mapping }],
      },
      {
        label: 'SpotCleaning',
        mode: 4,
        modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }, { value: RvcRunMode.ModeTag.Max }],
      },
      {
        label: 'Vacation',
        mode: 5,
        modeTags: [{ value: RvcRunMode.ModeTag.Vacation }],
      },
    ],
    currentMode: currentRunMode ?? 1,
  });
  return this;
};

MatterbridgeEndpoint.prototype.createDefaultRvcOperationalStateClusterServer = function (
  operationalStateList?: RvcOperationalState.OperationalStateStruct[],
  phaseList: string[] | null = null,
  currentPhase: number | null = null,
  operationalState?: RvcOperationalState.OperationalState,
  operationalError?: RvcOperationalState.ErrorStateStruct,
): MatterbridgeEndpoint {
  this.behaviors.require(MatterbridgeRoborockOperationalStateServer, {
    phaseList,
    currentPhase,
    operationalStateList: operationalStateList ?? [
      {
        operationalStateId: RvcOperationalState.OperationalState.Stopped,
        operationalStateLabel: 'Stopped',
      },
      {
        operationalStateId: RvcOperationalState.OperationalState.Running,
        operationalStateLabel: 'Running',
      },
      {
        operationalStateId: RvcOperationalState.OperationalState.Paused,
        operationalStateLabel: 'Paused',
      },
      {
        operationalStateId: RvcOperationalState.OperationalState.Error,
        operationalStateLabel: 'Error',
      },
      {
        operationalStateId: RvcOperationalState.OperationalState.SeekingCharger,
        operationalStateLabel: 'SeekingCharger',
      }, // Y RVC Pause Compatibility N RVC Resume Compatibility
      {
        operationalStateId: RvcOperationalState.OperationalState.Charging,
        operationalStateLabel: 'Charging',
      }, // N RVC Pause Compatibility Y RVC Resume Compatibility
      {
        operationalStateId: RvcOperationalState.OperationalState.Docked,
        operationalStateLabel: 'Docked',
      }, // N RVC Pause Compatibility Y RVC Resume Compatibility
    ],
    operationalState: operationalState ?? RvcOperationalState.OperationalState.Docked,
    operationalError: operationalError ?? {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Error',
      errorStateDetails: 'Fully operational',
    },
  });
  return this;
};

MatterbridgeEndpoint.prototype.createDefaultRvcCleanModeClusterServer = function (
  supportedCleanModes?: RvcCleanMode.ModeOption[],
  currentCleanMode?: number,
): MatterbridgeEndpoint {
  this.behaviors.require(MatterbridgeRoborockCleanModeServer, {
    supportedModes: supportedCleanModes ?? [
      {
        label: 'Vacuum',
        mode: 1,
        modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
      },
      {
        label: 'Mop',
        mode: 2,
        modeTags: [{ value: RvcCleanMode.ModeTag.Mop }],
      },
    ],
    currentMode: currentCleanMode ?? 1,
  });
  return this;
};

MatterbridgeEndpoint.prototype.createDefaultServiceAreaClusterServer = function (
  supportedAreas?: ServiceArea.Area[],
  selectedAreas?: number[],
  currentArea?: number,
): MatterbridgeEndpoint {
  this.behaviors.require(MatterbridgeRoborockServiceAreaServer, {
    supportedAreas: supportedAreas ?? [],
    selectedAreas: selectedAreas ?? [],
    currentArea: currentArea ?? 1,
    estimatedEndTime: null,
  });
  return this;
};
