import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { randomInt } from 'node:crypto';
import { SCENE_AREA_ID_MIN, SCENE_AREA_ID_MAX } from '../constants/index.js';
import { Scene } from '../roborockCommunication/models/index.js';

/**
 * Convert Roborock routines to Matter ServiceArea areas.
 */
export function getSupportedRoutines(routines: Scene[], log?: AnsiLogger): ServiceArea.Area[] {
  log?.debug('getSupportedRoutines', debugStringify(routines));

  if (!routines || routines.length === 0) {
    log?.debug('No routine found');
    return [];
  }

  const supportedRoutines: ServiceArea.Area[] = routines
    .filter((s) => s.enabled && s.name)
    .map((routine, index) => {
      return {
        areaId: routine.id != null ? SCENE_AREA_ID_MIN + routine.id : randomInt(SCENE_AREA_ID_MIN, SCENE_AREA_ID_MAX),
        mapId: null,
        areaInfo: {
          locationInfo: {
            locationName: routine.name ?? `Routine ${index}`,
            floorNumber: null,
            areaType: null,
          },
          landmarkInfo: null,
        },
      };
    });

  return supportedRoutines;
}
