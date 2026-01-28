import { CleanModeSetting } from './CleanModeSetting.js';
import { ModeConfig } from './modeConfig.js';

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
    configs: ModeConfig[],
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
    if (setting.suctionPower === 105) return 31;
    if (setting.waterFlow === 200) return 66;
    if (setting.suctionPower !== 105 && setting.waterFlow !== 200) return 5;
    return undefined;
  }
}

/**
 * Create resolver for default devices.
 */
export function createDefaultModeResolver(configs: ModeConfig[]): ModeResolver {
  return new ModeResolver(
    configs,
    (setting) => {
      if (setting.suctionPower === 106 || setting.waterFlow === 204 || setting.mopRoute === 302) {
        return 10;
      }
      return undefined;
    },
    BehaviorType.Default,
  );
}

/**
 * Create resolver for smart devices.
 */
export function createSmartModeResolver(configs: ModeConfig[]): ModeResolver {
  return new ModeResolver(
    configs,
    (setting) => {
      if (setting.suctionPower === 110 || setting.waterFlow === 209 || setting.mopRoute === 306) {
        return 4;
      }
      if (setting.suctionPower === 106 || setting.waterFlow === 204 || setting.mopRoute === 302) {
        return 10;
      }
      return undefined;
    },
    BehaviorType.Smart,
  );
}
