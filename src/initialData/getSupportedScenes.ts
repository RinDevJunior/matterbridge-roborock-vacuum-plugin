import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { Scene } from '../roborockCommunication/index.js';
import { randomInt } from 'node:crypto';
import { SCENE_AREA_ID_MIN, SCENE_AREA_ID_MAX } from '../constants/index.js';

/**
 * Convert Roborock scenes to Matter ServiceArea areas.
 * @param scenes - Array of scenes from device
 * @param log - Optional logger instance
 * @returns Array of supported service areas representing scenes
 */
export function getSupportedScenes(scenes: Scene[], log?: AnsiLogger): ServiceArea.Area[] {
  log?.debug('getSupportedScenes', debugStringify(scenes));

  if (!scenes || scenes.length === 0) {
    log?.debug('No scenes found');
    return [];
  }

  const supportedAreas: ServiceArea.Area[] = scenes
    .filter((s) => s.enabled && s.name)
    .map((scene) => {
      return {
        areaId: scene.id != null ? SCENE_AREA_ID_MIN + scene.id : randomInt(SCENE_AREA_ID_MIN, SCENE_AREA_ID_MAX),
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
