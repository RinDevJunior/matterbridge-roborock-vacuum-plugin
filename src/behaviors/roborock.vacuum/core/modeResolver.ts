import { MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { CleanModeDisplayLabel, CleanModeLabelInfo, CleanModeConfig } from './cleanModeConfig.js';

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
  private readonly customCheckFn?: (setting: CleanModeSetting) => number | undefined;

  constructor(
    configs: CleanModeConfig[],
    customCheckFn?: (setting: CleanModeSetting) => number | undefined,
    public readonly behavior = BehaviorType.Default,
  ) {
    this.settingsToModeMap = new Map(configs.map((c) => [this.serializeSetting(c.setting), c.mode]));
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
    if (setting.suctionPower === VacuumSuctionPower.Off) return CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode;
    if (setting.waterFlow === MopWaterFlow.Off) return CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode;
    if (setting.suctionPower !== VacuumSuctionPower.Off && setting.waterFlow !== MopWaterFlow.Off) return CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode;
    return undefined;
  }
}

/**
 * Create resolver for default devices.
 */
export function createDefaultModeResolver(configs: CleanModeConfig[]): ModeResolver {
  return new ModeResolver(
    configs,
    (setting) => {
      if (setting.isCustomMode) {
        return CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode;
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
  return new ModeResolver(
    configs,
    (setting) => {
      if (setting.isSmartMode) {
        return CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
      }
      if (setting.isCustomMode) {
        return CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumCustom].mode;
      }
      return undefined;
    },
    BehaviorType.Smart,
  );
}
