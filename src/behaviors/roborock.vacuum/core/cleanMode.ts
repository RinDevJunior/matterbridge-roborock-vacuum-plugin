import { CleanModeLabelInfo, CleanModeDisplayLabel } from './cleanModeConfig.js';

export const DefaultRvcCleanMode: Record<number, string> = {
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuick].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuick].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMax].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMax].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMin].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumMin].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuiet].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumQuiet].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].label,

  [CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopMax].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopMin].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopQuick].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.MopDeepClean].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.MopDeepClean].label,

  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuiet].label,
  [CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumQuick].label,

  [CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
};

export const SmartRvcCleanMode: Record<number, string> = {
  [CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].label,
  ...DefaultRvcCleanMode,
};
