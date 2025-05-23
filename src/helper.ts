import { Device } from './roborockCommunication/index.js';

export function getVacuumProperty(device: Device, property: string): number | undefined {
  if (device) {
    const schemas = device.schema;
    const schema = schemas.find((sch) => sch.code == property);

    if (schema && device.deviceStatus && device.deviceStatus[schema.id] != undefined) {
      return device.deviceStatus[schema.id];
    }
  }

  return undefined;
}

export function isSupportedDevice(model: string): boolean {
  return model.startsWith('roborock.vacuum.');
}
