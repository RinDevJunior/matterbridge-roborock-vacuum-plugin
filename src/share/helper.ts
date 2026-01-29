import { CloudMessageResult, Device } from '../roborockCommunication/models/index.js';

/** Get vacuum property by schema code or property name. */
export function getVacuumProperty(device: Device, property: string): number | undefined {
  if (!device) {
    return undefined;
  }

  const schemas = device.schema;
  const schema = schemas.find((sch) => sch.code === property);

  if (schema && device.deviceStatus && device.deviceStatus[schema.id] !== undefined) {
    return Number(device.deviceStatus[schema.id]);
  }

  if (device.deviceStatus && device.deviceStatus[property] !== undefined) {
    return Number(device.deviceStatus[property]);
  }

  return undefined;
}

/** Check if model is supported (roborock.vacuum.*). */
export function isSupportedDevice(model: string): boolean {
  return model.startsWith('roborock.vacuum.');
}

/** Check if result is a status update message. */
export function isStatusUpdate(result: unknown): boolean {
  return (
    Array.isArray(result) &&
    result.length > 0 &&
    typeof result[0] === 'object' &&
    result[0] !== null &&
    'msg_ver' in result[0] &&
    (result[0] as CloudMessageResult).msg_ver !== undefined &&
    (result[0] as CloudMessageResult).msg_ver !== null
  );
}
