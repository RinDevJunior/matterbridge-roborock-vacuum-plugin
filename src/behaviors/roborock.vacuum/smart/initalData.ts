import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { RvcCleanMode as RvcCleanModeDisplayMap } from './smart.js';
import { getDefaultSupportedCleanModes } from '../default/initalData.js';

export function getSupportedCleanModesSmart(): RvcCleanMode.ModeOption[] {
  return [
    {
      label: RvcCleanModeDisplayMap[4],
      mode: 4,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: RvcCleanModeDisplayMap[5],
      mode: 5,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Day }],
    },
    ...getDefaultSupportedCleanModes().filter((x) => x.mode !== 4 && x.mode !== 5), // Exclude modes 4 and 5 which are already defined
  ];
}
