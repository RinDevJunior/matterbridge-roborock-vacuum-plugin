import { CleanSequenceType, MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';
import { CleanModeConfig, CleanModeDisplayLabel, CleanModeLabelInfo } from './cleanModeConfig/index.js';
import { CleanModeSetting } from './CleanModeSetting.js';

function supportsMode(configs: CleanModeConfig[], mode: number): boolean {
	return configs.some((c) => c.mode === mode);
}

enum BehaviorType {
	Default = 'default',
	Smart = 'smart',
}

/**
 * Resolve current clean mode from device settings using mode configurations.
 * Supports both default and smart device types through configuration injection.
 */
export class ModeResolver {
	private readonly settingsToModeMap: Map<string, number>;
	private readonly configs: CleanModeConfig[];
	private readonly customCheckFn?: (setting: CleanModeSetting) => number | undefined;

	constructor(
		configs: CleanModeConfig[],
		customCheckFn?: (setting: CleanModeSetting) => number | undefined,
		public readonly behavior = BehaviorType.Default,
	) {
		this.settingsToModeMap = new Map(configs.map((c) => [this.serializeSetting(c.setting), c.mode]));
		this.configs = configs;
		this.customCheckFn = customCheckFn;
	}

	/**
	 * Determine current mode from device settings.
	 */
	public resolve(setting: CleanModeSetting): number | undefined {
		if (!setting || typeof setting !== 'object') {
			return undefined;
		}

		if (this.customCheckFn) {
			const customResult = this.customCheckFn(setting);
			if (customResult !== undefined) {
				return customResult;
			}
		}

		const serialized = this.serializeSetting(setting);
		const exactMatch = this.settingsToModeMap.get(serialized);
		if (exactMatch !== undefined) {
			return exactMatch;
		}

		return this.resolveFallback(setting);
	}

	private serializeSetting(setting: CleanModeSetting): string {
		return `${setting.suctionPower}:${setting.waterFlow}:${setting.mopRoute}`;
	}

	private resolveFallback(setting: CleanModeSetting): number | undefined {
		const isVacuumOff = setting.suctionPower === VacuumSuctionPower.Off;
		const isMopOff = setting.waterFlow === MopWaterFlow.Off;

		if (isVacuumOff) {
			const sameWaterFlow = this.configs.find(
				(c) => c.setting.suctionPower === VacuumSuctionPower.Off && c.setting.waterFlow === setting.waterFlow,
			);
			return sameWaterFlow ? sameWaterFlow.mode : CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode;
		}

		if (isMopOff) {
			const sameSuction = this.configs.find(
				(c) => c.setting.waterFlow === MopWaterFlow.Off && c.setting.suctionPower === setting.suctionPower,
			);
			return sameSuction ? sameSuction.mode : CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode;
		}

		const sameSuctionVacuumAndMop = this.configs.find(
			(c) =>
				c.setting.waterFlow !== MopWaterFlow.Off &&
				c.setting.suctionPower !== VacuumSuctionPower.Off &&
				c.setting.suctionPower === setting.suctionPower,
		);
		return sameSuctionVacuumAndMop
			? sameSuctionVacuumAndMop.mode
			: CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode;
	}
}

/**
 * Create resolver for default devices.
 */
export function createDefaultModeResolver(configs: CleanModeConfig[]): ModeResolver {
	const canResolveVacFollowedByMop = supportsMode(
		configs,
		CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode,
	);
	return new ModeResolver(
		configs,
		(setting) => {
			if (canResolveVacFollowedByMop && setting.sequenceType === CleanSequenceType.OneTime) {
				return CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode;
			}
			if (setting.isCustomMode) {
				return CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode;
			}
			return undefined;
		},
		BehaviorType.Default,
	);
}

/**
 * Create resolver for smart devices.
 */
export function createSmartModeResolver(configs: CleanModeConfig[]): ModeResolver {
	const canResolveVacFollowedByMop = supportsMode(
		configs,
		CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode,
	);
	return new ModeResolver(
		configs,
		(setting) => {
			if (setting.isSmartMode) {
				return CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
			}
			if (canResolveVacFollowedByMop && setting.sequenceType === CleanSequenceType.OneTime) {
				return CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode;
			}
			if (setting.isCustomMode) {
				return CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode;
			}
			return undefined;
		},
		BehaviorType.Smart,
	);
}
