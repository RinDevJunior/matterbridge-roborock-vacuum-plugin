import type { AnsiLogger } from 'matterbridge/logger';
import { debugStringify } from 'matterbridge/logger';
import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, bridgedNode } from 'matterbridge';
import { BridgedDeviceBasicInformation, Descriptor, Identify, ServiceArea } from 'matterbridge/matter/clusters';
import { isValidNumber, isValidString } from 'matterbridge/utils';
import { UINT16_MAX, UINT32_MAX } from 'matterbridge/matter';
import { PlatformConfigManager } from './platformConfigManager.js';
import { DeviceRegistry } from './deviceRegistry.js';
import { RoborockService } from '../services/roborockService.js';
import { PlatformRunner } from '../platformRunner.js';
import type { Device } from '../roborockCommunication/models/index.js';
import { RoomMap } from '../core/application/models/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { configureBehavior } from '../share/behaviorFactory.js';
import { getSupportedAreas, getSupportedScenes } from '../initialData/index.js';

/**
 * Handles device configuration: local network setup, room mapping,
 * behavior configuration, and Matterbridge device registration.
 */
export class DeviceConfigurator {
  public rrHomeId: number | undefined;

  public constructor(
    private readonly platform: MatterbridgeDynamicPlatform,
    private readonly configManager: PlatformConfigManager,
    private readonly registry: DeviceRegistry,
    private readonly getPlatformRunner: () => PlatformRunner,
    private readonly log: AnsiLogger,
  ) {}

  public async onConfigureDevice(roborockService: RoborockService): Promise<void> {
    this.log.info('onConfigureDevice start');

    const username = this.configManager.username;
    if (!this.registry.hasDevices() || !username) {
      this.log.error('Initializing: No supported devices found');
      return;
    }

    const configureSuccess = new Map<string, boolean>();

    roborockService.setDeviceNotify((payload) => {
      this.getPlatformRunner().updateRobotWithPayload(payload);
    });

    for (const vacuum of this.registry.getAllDevices()) {
      const success = await this.configureDevice(vacuum, roborockService);
      configureSuccess.set(vacuum.duid, success);
      if (success) {
        this.rrHomeId = vacuum.rrHomeId;
      }
    }

    for (const [duid, robot] of this.registry.robotsMap) {
      if (!configureSuccess.get(duid)) {
        continue;
      }
      roborockService.activateDeviceNotify(robot.device);
    }

    try {
      await this.getPlatformRunner().requestHomeData();
    } catch (error) {
      this.log.error(`requestHomeData (initial) failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // During initial configuration, we delay activating handlers until all devices are configured.
    this.log.notice('Activating device notify handlers');
    this.getPlatformRunner().activateHandlerFunctions();

    this.log.info('onConfigureDevice finished');
  }

  private async configureDevice(vacuum: Device, roborockService: RoborockService): Promise<boolean> {
    const username = this.configManager.username;

    const connectedToLocalNetwork = await roborockService.initializeMessageClientForLocal(vacuum);

    if (!connectedToLocalNetwork) {
      this.log.error(`Failed to connect to local network for device: ${vacuum.name} (${vacuum.duid})`);
      return false;
    }

    // Fetch rooms if not already available
    const { mapInfo, roomMap } = await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
    this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));

    const homeData = vacuum.store.homeData;
    const homeInfo = new HomeEntity(homeData.id, homeData.name, roomMap, mapInfo);

    const behaviorHandler = configureBehavior(
      vacuum.specs.model,
      vacuum.duid,
      roborockService,
      this.configManager.isCustomCleanModeMappingEnabled,
      this.configManager.cleanModeSettings,
      this.configManager.forceRunAtDefault,
      this.log,
    );

    const { supportedAreas, roomIndexMap } = getSupportedAreas(homeInfo, this.log);
    roborockService.setSupportedAreas(vacuum.duid, supportedAreas);
    roborockService.setSupportedAreaIndexMap(vacuum.duid, roomIndexMap);

    let routineAsRoom: ServiceArea.Area[] = [];
    if (this.configManager.showRoutinesAsRoom) {
      routineAsRoom = getSupportedScenes(vacuum.scenes ?? [], this.log);
      roborockService.setSupportedScenes(vacuum.duid, routineAsRoom);
    }

    const robot = new RoborockVacuumCleaner(username, vacuum, homeInfo, routineAsRoom, this.configManager, this.log);
    robot.configureHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));
    if (this.platform.validateDevice(robot.deviceName ?? '')) {
      await this.addDevice(robot);
    }

    return true;
  }

  private async addDevice(device: RoborockVacuumCleaner): Promise<MatterbridgeEndpoint | undefined> {
    if (!device.serialNumber || !device.deviceName) {
      this.log.warn('Cannot add device: missing serialNumber or deviceName');
      return undefined;
    }
    this.platform.setSelectDevice(device.serialNumber, device.deviceName, undefined, 'hub');

    const vacuumData = device.device.specs;
    const hardwareVersionString = vacuumData.firmwareVersion ?? device.device.fv ?? this.platform.matterbridge.matterbridgeVersion;

    if (this.platform.validateDevice(device.deviceName)) {
      device.softwareVersion = parseInt(this.platform.version.replace(/\D/g, ''));
      device.softwareVersionString = this.platform.version === '' ? 'Unknown' : this.platform.version;
      device.hardwareVersion = parseInt(hardwareVersionString.replace(/\D/g, ''));
      device.hardwareVersionString = hardwareVersionString;

      device.softwareVersion = isValidNumber(device.softwareVersion, 0, UINT32_MAX) ? device.softwareVersion : undefined;
      device.softwareVersionString = isValidString(device.softwareVersionString) ? device.softwareVersionString.slice(0, 64) : undefined;
      device.hardwareVersion = isValidNumber(device.hardwareVersion, 0, UINT16_MAX) ? device.hardwareVersion : undefined;
      device.hardwareVersionString = isValidString(device.hardwareVersionString) ? device.hardwareVersionString.slice(0, 64) : undefined;

      device.vendorName = 'Roborock';
      device.productName = vacuumData.model;
      device.productUrl = 'https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin';

      const options = device.getClusterServerOptions(BridgedDeviceBasicInformation.Cluster.id);
      if (options) {
        options.softwareVersion = device.softwareVersion ?? 1;
        options.softwareVersionString = device.softwareVersionString ?? '1.0.0';
        options.hardwareVersion = device.hardwareVersion ?? 1;
        options.hardwareVersionString = device.hardwareVersionString ?? '1.0.0';
      }

      device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.AudibleBeep);

      // We need to add bridgedNode device type and BridgedDeviceBasicInformation cluster for single class devices that doesn't add it in childbridge mode.
      if (device.mode === undefined && !device.deviceTypes.has(bridgedNode.code)) {
        device.deviceTypes.set(bridgedNode.code, bridgedNode);
        const options = device.getClusterServerOptions(Descriptor.Cluster.id);
        if (options) {
          const deviceTypeList = options.deviceTypeList as { deviceType: number; revision: number }[];
          if (!deviceTypeList.find((dt) => dt.deviceType === bridgedNode.code)) {
            deviceTypeList.push({ deviceType: bridgedNode.code, revision: bridgedNode.revision });
          }
        }
        device.createDefaultBridgedDeviceBasicInformationClusterServer(
          device.deviceName,
          device.serialNumber,
          device.vendorId,
          device.vendorName,
          device.productName,
          device.softwareVersion,
          device.softwareVersionString,
          device.hardwareVersion,
          device.hardwareVersionString,
        );
      }

      await this.platform.registerDevice(device);
      this.registry.registerRobot(device as RoborockVacuumCleaner);
      return device;
    } else {
      return undefined;
    }
  }
}
