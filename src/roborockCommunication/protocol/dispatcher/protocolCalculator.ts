import { NewProtocolVersion, ProtocolVersion } from '../../enums/index.js';
import { DeviceModel } from '../../models/deviceModel.js';

export function calculateProtocol(protocol: ProtocolVersion | string, model: DeviceModel): NewProtocolVersion {
  switch (protocol) {
    case ProtocolVersion.V1:
    case ProtocolVersion.L01:
      return NewProtocolVersion.V1;

    case ProtocolVersion.B01: {
      const shortModelCode = model?.split('.').at(-1);
      if (shortModelCode === undefined) {
        throw new Error('Missing robot model, required for B01 protocol');
      }

      if (shortModelCode.startsWith('ss')) {
        return NewProtocolVersion.Q10;
      } else if (shortModelCode.startsWith('sc')) {
        return NewProtocolVersion.Q7;
      } else {
        // throw new Error('Unsupported robot model: ' + model + ', for B01 protocol');
        throw new Error(`Unsupported robot model: ${model}, protocol: ${protocol}, for B01 protocol`);
      }
    }

    default:
      throw new Error('Unsupported protocol version: ' + protocol);
  }
}
