import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface PackageJson {
  engines: Record<string, string>;
  name: string;
  version: string;
  homepage: string;
}

const PACKAGE_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const PACKAGE = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as PackageJson;

export const ENGINES = PACKAGE.engines;
export const PLUGIN_NAME = PACKAGE.name;
export const PLUGIN_VERSION = PACKAGE.version;
export const PLUGIN_URL = PACKAGE.homepage;
