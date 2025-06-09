import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { RvcCleanMode as RvcCleanModeDisplayMap } from './smart.js';

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
    {
      label: RvcCleanModeDisplayMap[6],
      mode: 6,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
    {
      label: RvcCleanModeDisplayMap[7],
      mode: 7,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[8],
      mode: 8,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Min }],
    },
    {
      label: RvcCleanModeDisplayMap[9],
      mode: 9,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
    },
    {
      label: RvcCleanModeDisplayMap[10],
      mode: 10,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
    },

    {
      label: RvcCleanModeDisplayMap[11],
      mode: 11,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Auto }],
    },

    {
      label: RvcCleanModeDisplayMap[12],
      mode: 12,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[13],
      mode: 13,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Min }],
    },
    {
      label: RvcCleanModeDisplayMap[14],
      mode: 14,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Quick }],
    },
    {
      label: RvcCleanModeDisplayMap[15],
      mode: 15,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.DeepClean }],
    },
    {
      label: RvcCleanModeDisplayMap[16],
      mode: 16,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Auto }],
    },
    {
      label: RvcCleanModeDisplayMap[17],
      mode: 17,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Max }],
    },
    {
      label: RvcCleanModeDisplayMap[18],
      mode: 18,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quiet }],
    },
    {
      label: RvcCleanModeDisplayMap[19],
      mode: 19,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Quick }],
    },
  ];
}
