import { CleanModeSetting } from '../CleanModeSetting.js';

export interface CleanModeConfig {
	mode: number;
	label: string;
	setting: CleanModeSetting;
	modeTags: { value: number }[];
}

// prettier-ignore
export enum CleanModeDisplayLabel {
  SmartPlan =                     'Smart Plan',

  VacuumAndMopDefault =           'Vacuum & Mop: Default',
  VacuumAndMopQuick =             'Vacuum & Mop: Quick',
  VacuumAndMopMax =               'Vacuum & Mop: Max',
  VacuumAndMopMin =               'Vacuum & Mop: Min',
  VacuumAndMopQuiet =             'Vacuum & Mop: Quiet',
  VacuumAndMopEnergySaving =      'Vacuum & Mop: Energy Saving',
  VacFollowedByMop =              'Vacuum & Mop: Vac Follow by Mop',
  VacuumAndMopDeep =              'Vacuum & Mop: Deep',

  MopDefault =                    'Mop: Default',
  MopMax =                        'Mop: Max',
  MopMin =                        'Mop: Min',
  MopQuick =                      'Mop: Quick',
  MopDeep =                       'Mop: Deep',

  VacuumDefault =                 'Vacuum: Default',
  VacuumMin =                     'Vacuum: Min',
  VacuumMax =                     'Vacuum: Max',
  VacuumQuiet =                   'Vacuum: Quiet',
  VacuumQuick =                   'Vacuum: Quick',
  GoVacation =                    'Go Vacation',
}

export type CleanModeLabel =
	| CleanModeDisplayLabel.SmartPlan
	| CleanModeDisplayLabel.VacuumAndMopDefault
	| CleanModeDisplayLabel.VacuumAndMopQuick
	| CleanModeDisplayLabel.VacuumAndMopMax
	| CleanModeDisplayLabel.VacuumAndMopMin
	| CleanModeDisplayLabel.VacuumAndMopQuiet
	| CleanModeDisplayLabel.VacuumAndMopEnergySaving
	| CleanModeDisplayLabel.VacuumAndMopDeep
	| CleanModeDisplayLabel.MopDefault
	| CleanModeDisplayLabel.MopMax
	| CleanModeDisplayLabel.MopMin
	| CleanModeDisplayLabel.MopQuick
	| CleanModeDisplayLabel.MopDeep
	| CleanModeDisplayLabel.VacuumDefault
	| CleanModeDisplayLabel.VacuumMax
	| CleanModeDisplayLabel.VacuumQuiet
	| CleanModeDisplayLabel.VacuumQuick
	| CleanModeDisplayLabel.GoVacation
	| CleanModeDisplayLabel.VacFollowedByMop;

interface CleanModeLabelInfoStruct {
	label: CleanModeLabel;
	mode: number;
}

// prettier-ignore
export const CleanModeLabelInfo: Record<CleanModeLabel, CleanModeLabelInfoStruct> = {
  [CleanModeDisplayLabel.SmartPlan]:                      { mode: 4, label: CleanModeDisplayLabel.SmartPlan },
  [CleanModeDisplayLabel.VacuumAndMopDefault]:            { mode: 5, label: CleanModeDisplayLabel.VacuumAndMopDefault },
  [CleanModeDisplayLabel.VacuumAndMopQuick]:              { mode: 6, label: CleanModeDisplayLabel.VacuumAndMopQuick },
  [CleanModeDisplayLabel.VacuumAndMopMax]:                { mode: 7, label: CleanModeDisplayLabel.VacuumAndMopMax },
  [CleanModeDisplayLabel.VacuumAndMopMin]:                { mode: 8, label: CleanModeDisplayLabel.VacuumAndMopMin },
  [CleanModeDisplayLabel.VacuumAndMopQuiet]:              { mode: 9, label: CleanModeDisplayLabel.VacuumAndMopQuiet },
  [CleanModeDisplayLabel.VacuumAndMopEnergySaving]:       { mode: 10, label: CleanModeDisplayLabel.VacuumAndMopEnergySaving },
  [CleanModeDisplayLabel.VacFollowedByMop]:               { mode: 11, label: CleanModeDisplayLabel.VacFollowedByMop },
  [CleanModeDisplayLabel.VacuumAndMopDeep]:               { mode: 12, label: CleanModeDisplayLabel.VacuumAndMopDeep },
  [CleanModeDisplayLabel.MopDefault]:                     { mode: 31, label: CleanModeDisplayLabel.MopDefault },
  [CleanModeDisplayLabel.MopMax]:                         { mode: 32, label: CleanModeDisplayLabel.MopMax },
  [CleanModeDisplayLabel.MopMin]:                         { mode: 33, label: CleanModeDisplayLabel.MopMin },
  [CleanModeDisplayLabel.MopQuick]:                       { mode: 34, label: CleanModeDisplayLabel.MopQuick },
  [CleanModeDisplayLabel.MopDeep]:                        { mode: 35, label: CleanModeDisplayLabel.MopDeep },
  [CleanModeDisplayLabel.VacuumDefault]:                  { mode: 66, label: CleanModeDisplayLabel.VacuumDefault },
  [CleanModeDisplayLabel.VacuumMax]:                      { mode: 67, label: CleanModeDisplayLabel.VacuumMax },
  [CleanModeDisplayLabel.VacuumQuiet]:                    { mode: 68, label: CleanModeDisplayLabel.VacuumQuiet },
  [CleanModeDisplayLabel.VacuumQuick]:                    { mode: 69, label: CleanModeDisplayLabel.VacuumQuick },
  [CleanModeDisplayLabel.GoVacation]:                     { mode: 99, label: CleanModeDisplayLabel.GoVacation },
};
