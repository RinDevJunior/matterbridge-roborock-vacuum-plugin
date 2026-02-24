interface MqttOtaStatus {
  status?: string;
}

interface MqttOtaProgress {
  progress?: number;
}

interface MqttOtaData {
  mqttOtaStatus?: MqttOtaStatus;
  mqttOtaProgress?: MqttOtaProgress;
}

export interface DeviceOTAData {
  mqttOtaData?: MqttOtaData;
  online?: boolean;
}
