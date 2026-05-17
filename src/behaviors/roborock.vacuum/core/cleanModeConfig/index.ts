export * from './helpers.js';
export * from './mopOnly.js';
export * from './special.js';
export * from './types.js';
export * from './vacuumAndMop.js';
export * from './vacuumOnly.js';

import { mopOnlyModeConfigs } from './mopOnly.js';
import { smartPlanModeConfig, vacFollowedByMopModeConfig } from './special.js';
import { CleanModeConfig } from './types.js';
import { vacuumAndMopModeConfigs } from './vacuumAndMop.js';
import { vacuumOnlyModeConfigs } from './vacuumOnly.js';

export const baseCleanModeConfigs: CleanModeConfig[] = [
	...vacuumAndMopModeConfigs,
	...mopOnlyModeConfigs,
	...vacuumOnlyModeConfigs,
];

export const smartCleanModeConfigs: CleanModeConfig[] = [
	smartPlanModeConfig,
	vacFollowedByMopModeConfig,
	...baseCleanModeConfigs,
];
