import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanModeSetting } from '../CleanModeSetting.js';
import { CleanModeConfig } from './types.js';

export function getModeDisplayMap(configs: CleanModeConfig[]): Record<number, string> {
	return Object.fromEntries(configs.map((c) => [c.mode, c.label]));
}

export function getModeSettingsMap(configs: CleanModeConfig[]): Record<number, CleanModeSetting> {
	return Object.fromEntries(configs.map((c) => [c.mode, c.setting]));
}

export function getModeOptions(configs: CleanModeConfig[]): RvcCleanMode.ModeOption[] {
	return configs.map((c) => ({
		mode: c.mode,
		label: c.label,
		modeTags: c.modeTags,
	}));
}
