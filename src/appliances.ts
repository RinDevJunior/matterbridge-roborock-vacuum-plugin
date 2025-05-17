import {
  DeviceTypeDefinition,
  MatterbridgeEndpoint,
  powerSource,
} from "matterbridge";

export class Appliances extends MatterbridgeEndpoint {
  constructor(deviceType: DeviceTypeDefinition, name: string, serial: string) {
    super(
      [deviceType, powerSource],
      { uniqueStorageKey: `${name}-${serial}` },
      true,
    );
  }
}
