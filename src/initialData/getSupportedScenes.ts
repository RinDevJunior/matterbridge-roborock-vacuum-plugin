import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { Scene } from '../roborockCommunication/index.js';
import { randomInt } from 'crypto';

export function getSupportedScenes(scenes: Scene[], log?: AnsiLogger): ServiceArea.Area[] {
  log?.debug('getSupportedScenes', debugStringify(scenes));

  if (!scenes || scenes.length === 0) {
    log?.error('No scenes found');
    return [];
  }

  const supportedAreas: ServiceArea.Area[] = scenes
    .filter((s) => s.enabled && s.id)
    .map((scene) => {
      return {
        areaId: scene.id! + randomInt(5000, 9000),
        mapId: null,
        areaInfo: {
          locationInfo: {
            locationName: `Scene: ${scene.name}`,
            floorNumber: null,
            areaType: null,
          },
          landmarkInfo: null,
        },
      };
    });

  return supportedAreas;
}
