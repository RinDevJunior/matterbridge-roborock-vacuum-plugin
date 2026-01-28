import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { CleanModeLabelInfo, CleanModeDisplayLabel } from './modeConfig.js';

export const DefaultCleanSetting: Record<number, CleanModeSetting> = {
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode]: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard), // 'Vac & Mop Default'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuick].mode]: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Fast), // 'Vac & Mop Quick'

  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMax].mode]: new CleanModeSetting(VacuumSuctionPower.Max, MopWaterFlow.Medium, 0, MopRoute.Standard), // 'Vac & Mop Max'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMin].mode]: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Low, 0, MopRoute.Standard), // 'Vac & Mop Min'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuiet].mode]: new CleanModeSetting(VacuumSuctionPower.Quiet, MopWaterFlow.Medium, 0, MopRoute.Standard), // 'Vac & Mop Quiet'

  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode]: new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom), // 'Vac & Mop Custom -> LowEnergy'

  [CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode]: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Standard), // 'Mop Default'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].mode]: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.High, 0, MopRoute.Standard), // 'MopMax'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].mode]: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Low, 0, MopRoute.Standard), // 'MopMin'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].mode]: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Fast), // 'MopQuick'
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopDeepClean].mode]: new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Deep), // 'MopDeepClean'

  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode]: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Standard), // 'Vacuum Default'
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].mode]: new CleanModeSetting(VacuumSuctionPower.Max, MopWaterFlow.Off, 0, MopRoute.Standard), // 'VacuumMax'
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].mode]: new CleanModeSetting(VacuumSuctionPower.Quiet, MopWaterFlow.Off, 0, MopRoute.Standard), // 'VacuumQuiet'
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].mode]: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Fast), // 'VacuumQuick'
};

export const SmartCleanSetting: Record<number, CleanModeSetting> = {
  [CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode]: new CleanModeSetting(0, 0, 0, MopRoute.Smart),
  ...DefaultCleanSetting,
};
