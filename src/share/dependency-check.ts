import semver from 'semver';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import { ENGINES, PLUGIN_NAME, PLUGIN_VERSION } from '../settings.js';

/** Log and validate critical package and runtime versions. */
export function checkDependencyVersions(platform: MatterbridgeDynamicPlatform): void {
  const { log } = platform;

  // prettier-ignore
  const versions: [string, string, string | undefined][] = [
    [PLUGIN_NAME,       PLUGIN_VERSION,                               undefined],
    ['Nodejs',          process.versions.node,                        ENGINES['node']],
    ['Matterbridge',    platform.matterbridge.matterbridgeVersion,    ENGINES['matterbridge']],
  ];

  for (const [name, current, required] of versions) {
    const coerced = semver.coerce(current);

    if (!required) {
      log.info(`${name} version ${current}`);
    } else if (coerced === null) {
      log.warn(`${name} version ${current} cannot be coerced to semver (require ${required})`);
    } else if (semver.satisfies(coerced, required)) {
      log.info(`${name} version ${current} (satisfies ${required})`);
    } else {
      log.error(`${name} version ${current} is incompatible (require ${required})`);
    }
  }
}
