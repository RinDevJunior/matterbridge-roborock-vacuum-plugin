import type { AnsiLogger } from 'matterbridge/logger';
import { debugStringify } from 'matterbridge/logger';
import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, bridgedNode } from 'matterbridge';
import { BridgedDeviceBasicInformation, Descriptor, Identify } from 'matterbridge/matter/clusters';
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

    if (!this.registry.hasDevices()) {
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
    const connectedToLocalNetwork = await roborockService.initializeMessageClientForLocal(vacuum);

    if (!connectedToLocalNetwork) {
      this.log.error(`Failed to connect to local network for device: ${vacuum.name} (${vacuum.duid})`);
      return false;
    }

    // Fetch rooms if not already available
    const { activeMapId, mapInfo, roomMap } = await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
    this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));

    const homeData = vacuum.store.homeData;
    const homeInfo = new HomeEntity(homeData.id, homeData.name, roomMap, mapInfo, activeMapId);

    const robot = new RoborockVacuumCleaner(vacuum, homeInfo, this.configManager, roborockService, this.log);

    const behaviorHandler = configureBehavior(
      vacuum.specs.model,
      vacuum.duid,
      roborockService,
      this.configManager.isCustomCleanModeMappingEnabled,
      this.configManager.cleanModeSettings,
      this.configManager.forceRunAtDefault,
      this.log,
    );

    robot.configureHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));
    if (this.platform.validateDevice(robot.deviceName ?? '')) {
      await this.addDevice(robot);
    }

    return true;
  }

  private async addDevice(rvc: RoborockVacuumCleaner): Promise<MatterbridgeEndpoint | undefined> {
    if (!rvc.device.duid || !rvc.deviceName) {
      this.log.warn('Cannot add device: missing rvc or deviceName');
      return undefined;
    }
    this.platform.setSelectDevice(rvc.device.duid, rvc.deviceName, undefined, 'hub');

    const vacuumData = rvc.device.specs;
    const hardwareVersionString =
      vacuumData.firmwareVersion ?? rvc.device.fv ?? this.platform.matterbridge.matterbridgeVersion;

    if (this.platform.validateDevice(rvc.deviceName)) {
      rvc.softwareVersion = parseInt(this.platform.version.replace(/\D/g, ''));
      rvc.softwareVersionString = this.platform.version === '' ? 'Unknown' : this.platform.version;
      rvc.hardwareVersion = parseInt(hardwareVersionString.replace(/\D/g, ''));
      rvc.hardwareVersionString = hardwareVersionString;

      rvc.softwareVersion = isValidNumber(rvc.softwareVersion, 0, UINT32_MAX) ? rvc.softwareVersion : undefined;
      rvc.softwareVersionString = isValidString(rvc.softwareVersionString)
        ? rvc.softwareVersionString.slice(0, 64)
        : undefined;
      rvc.hardwareVersion = isValidNumber(rvc.hardwareVersion, 0, UINT16_MAX) ? rvc.hardwareVersion : undefined;
      rvc.hardwareVersionString = isValidString(rvc.hardwareVersionString)
        ? rvc.hardwareVersionString.slice(0, 64)
        : undefined;

      if (this.configManager.overrideMatterConfiguration) {
        const customMatterConfiguration = this.configManager.matterOverrideSettings;
        this.platform.log.debug(`customMatterConfiguration: ${debugStringify(customMatterConfiguration)}`);

        rvc.vendorName =
          customMatterConfiguration.matterVendorName?.length > 0
            ? customMatterConfiguration.matterVendorName
            : 'Matterbridge';
        rvc.productName =
          customMatterConfiguration.matterProductName?.length > 0
            ? customMatterConfiguration.matterProductName
            : vacuumData.model;
        rvc.vendorId = customMatterConfiguration.matterVendorId > 0 ? customMatterConfiguration.matterVendorId : 65521;
        rvc.productId =
          customMatterConfiguration.matterProductId > 0 ? customMatterConfiguration.matterProductId : 32768;
        rvc.productUrl = 'https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin';
      }

      const options = rvc.getClusterServerOptions(BridgedDeviceBasicInformation.Cluster.id);
      if (options) {
        options.softwareVersion = rvc.softwareVersion ?? 1;
        options.softwareVersionString = rvc.softwareVersionString ?? '1.0.0';
        options.hardwareVersion = rvc.hardwareVersion ?? 1;
        options.hardwareVersionString = rvc.hardwareVersionString ?? '1.0.0';
      }

      rvc.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.AudibleBeep);

      // We need to add bridgedNode device type and BridgedDeviceBasicInformation cluster for single class devices that doesn't add it in childbridge mode.
      if (rvc.mode === undefined && !rvc.deviceTypes.has(bridgedNode.code)) {
        rvc.deviceTypes.set(bridgedNode.code, bridgedNode);
        const options = rvc.getClusterServerOptions(Descriptor.Cluster.id);
        if (options) {
          const deviceTypeList = options.deviceTypeList as { deviceType: number; revision: number }[];
          if (!deviceTypeList.find((dt) => dt.deviceType === bridgedNode.code)) {
            deviceTypeList.push({ deviceType: bridgedNode.code, revision: bridgedNode.revision });
          }
        }
        rvc.createDefaultBridgedDeviceBasicInformationClusterServer(
          rvc.deviceName,
          rvc.device.duid,
          rvc.vendorId,
          rvc.vendorName,
          rvc.productName,
          rvc.softwareVersion,
          rvc.softwareVersionString,
          rvc.hardwareVersion,
          rvc.hardwareVersionString,
        );
      }

      await this.platform.registerDevice(rvc);
      this.registry.registerRobot(rvc as RoborockVacuumCleaner);
      return rvc;
    } else {
      return undefined;
    }
  }
}
