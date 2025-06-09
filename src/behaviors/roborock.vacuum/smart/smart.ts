import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';

export interface EndpointCommandsSmart extends DeviceCommands {
  selectAreas: (newAreas: number[] | undefined) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  playSoundToLocate: (identifyTime: number) => MaybePromise;
}

export class BehaviorSmart extends BehaviorRoborock {
  declare state: BehaviorRoborockSmartState;
}

export interface BehaviorRoborockSmartState {
  device: BehaviorDeviceGeneric<EndpointCommandsSmart>;
}

// suction_power
export enum VacuumSuctionPowerSmart {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
  Smart = 110,
}

// water_box_mode
export enum MopWaterFlowSmart {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
  Smart = 209,
}

// set_mop_mode
export enum MopRouteSmart {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
  Smart = 306,
}

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', // DO NOT HANDLE HERE,
  [2]: 'Cleaning',
  [3]: 'Mapping',
};

export const RvcCleanMode: Record<number, string> = {
  [4]: 'Smart Plan',
  [5]: 'Mop & Vacuum: Default',
  [6]: 'Mop & Vacuum: Quick',
  [7]: 'Mop & Vacuum: Max',
  [8]: 'Mop & Vacuum: Min',
  [9]: 'Mop & Vacuum: Quiet',
  [10]: 'Mop & Vacuum: Custom',

  [11]: 'Mop: Default',
  [12]: 'Mop: Max',
  [13]: 'Mop: Min',
  [14]: 'Mop: Quick',
  [15]: 'Mop: DeepClean',

  [16]: 'Vacuum: Default',
  [17]: 'Vacuum: Max',
  [18]: 'Vacuum: Quiet',
  [19]: 'Vacuum: Quick',
};

export const CleanSetting: Record<number, { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> = {
  [4]: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: MopRouteSmart.Smart }, // 'Smart Plan'

  [5]: { suctionPower: VacuumSuctionPowerSmart.Balanced, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Vac & Mop Default'
  [6]: { suctionPower: VacuumSuctionPowerSmart.Balanced, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Fast }, // 'Vac & Mop Quick'

  [7]: { suctionPower: VacuumSuctionPowerSmart.Max, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Vac & Mop Max'
  [8]: { suctionPower: VacuumSuctionPowerSmart.Balanced, waterFlow: MopWaterFlowSmart.Low, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Vac & Mop Min'
  [9]: { suctionPower: VacuumSuctionPowerSmart.Quiet, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Vac & Mop Quiet'
  [10]: { suctionPower: VacuumSuctionPowerSmart.Custom, waterFlow: MopWaterFlowSmart.Custom, distance_off: 0, mopRoute: MopRouteSmart.Custom }, // 'Vac & Mop Custom'

  [11]: { suctionPower: VacuumSuctionPowerSmart.Off, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Mop Default'
  [12]: { suctionPower: VacuumSuctionPowerSmart.Off, waterFlow: MopWaterFlowSmart.High, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'MopMax'
  [13]: { suctionPower: VacuumSuctionPowerSmart.Off, waterFlow: MopWaterFlowSmart.Low, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'MopMin'
  [14]: { suctionPower: VacuumSuctionPowerSmart.Off, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Fast }, // 'MopQuick'
  [15]: { suctionPower: VacuumSuctionPowerSmart.Off, waterFlow: MopWaterFlowSmart.Medium, distance_off: 0, mopRoute: MopRouteSmart.Deep }, // 'MopDeepClean'

  [16]: { suctionPower: VacuumSuctionPowerSmart.Balanced, waterFlow: MopWaterFlowSmart.Off, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'Vacuum Default'
  [17]: { suctionPower: VacuumSuctionPowerSmart.Max, waterFlow: MopWaterFlowSmart.Off, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'VacuumMax'
  [18]: { suctionPower: VacuumSuctionPowerSmart.Quiet, waterFlow: MopWaterFlowSmart.Off, distance_off: 0, mopRoute: MopRouteSmart.Standard }, // 'VacuumQuiet'
  [19]: { suctionPower: VacuumSuctionPowerSmart.Balanced, waterFlow: MopWaterFlowSmart.Off, distance_off: 0, mopRoute: MopRouteSmart.Fast }, // 'VacuumQuick'
};

export function setCommandHandlerSmart(
  duid: string,
  handler: BehaviorDeviceGeneric<EndpointCommandsSmart>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('BehaviorSmart-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        break;
      }
      case 'Smart Plan':
      case 'Mop & Vacuum: Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        break;
      }

      case 'Mop & Vacuum: Default':
      case 'Mop: Default':
      case 'Vacuum: Default': {
        const setting = cleanModeSettings ? (getSettingFromCleanMode(activity, cleanModeSettings) ?? CleanSetting[newMode]) : CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        break;
      }

      case 'Mop & Vacuum: Quick':
      case 'Mop & Vacuum: Max':
      case 'Mop & Vacuum: Min':
      case 'Mop & Vacuum: Quiet':
      case 'Mop: Max':
      case 'Mop: Min':
      case 'Mop: Quick':
      case 'Mop: DeepClean':
      case 'Vacuum: Max':
      case 'Vacuum: Min':
      case 'Vacuum: Quiet':
      case 'Vacuum: Quick': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        break;
      }
      default:
        logger.notice('BehaviorSmart-changeToMode-Unknown: ', newMode);
        break;
    }
  });

  const getSettingFromCleanMode = (
    activity: string,
    cleanModeSettings?: CleanModeSettings,
  ): { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number } | undefined => {
    switch (activity) {
      case 'Mop: Default': {
        const mopSetting = cleanModeSettings?.mopping;
        const waterFlow = MopWaterFlowSmart[mopSetting?.waterFlowMode as keyof typeof MopWaterFlowSmart] ?? MopWaterFlowSmart.Medium;
        const distance_off = waterFlow == MopWaterFlowSmart.CustomizeWithDistanceOff ? 210 - 5 * (mopSetting?.distanceOff ?? 25) : 0;
        return {
          suctionPower: VacuumSuctionPowerSmart.Off,
          waterFlow,
          distance_off,
          mopRoute: MopRouteSmart[mopSetting?.mopRouteMode as keyof typeof MopRouteSmart] ?? MopRouteSmart.Standard,
        };
      }

      case 'Vacuum: Default': {
        const vacuumSetting = cleanModeSettings?.vacuuming;
        return {
          suctionPower: VacuumSuctionPowerSmart[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPowerSmart] ?? VacuumSuctionPowerSmart.Balanced,
          waterFlow: MopWaterFlowSmart.Off,
          distance_off: 0,
          mopRoute: MopRouteSmart[vacuumSetting?.mopRouteMode as keyof typeof MopRouteSmart] ?? MopRouteSmart.Standard,
        };
      }

      case 'Mop & Vacuum: Default': {
        const vacmopSetting = cleanModeSettings?.vacmop;
        const waterFlow = MopWaterFlowSmart[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlowSmart] ?? MopWaterFlowSmart.Medium;
        const distance_off = waterFlow == MopWaterFlowSmart.CustomizeWithDistanceOff ? 210 - 5 * (vacmopSetting?.distanceOff ?? 25) : 0;
        return {
          suctionPower: VacuumSuctionPowerSmart[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPowerSmart] ?? VacuumSuctionPowerSmart.Balanced,
          waterFlow,
          distance_off,
          mopRoute: MopRouteSmart[vacmopSetting?.mopRouteMode as keyof typeof MopRouteSmart] ?? MopRouteSmart.Standard,
        };
      }
      default:
        return undefined;
    }
  };

  handler.setCommandHandler('selectAreas', async (newAreas: number[] | undefined) => {
    logger.notice(`BehaviorSmart-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('BehaviorSmart-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('BehaviorSmart-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('BehaviorSmart-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('playSoundToLocate', async () => {
    logger.notice('BehaviorSmart-playSoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
