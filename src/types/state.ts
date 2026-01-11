/**
 * State management and runtime type definitions.
 * @module types/state
 */

import type { ServiceArea } from 'matterbridge/matter/clusters';
import type { RoomIndexMap } from '../model/RoomIndexMap.js';

/**
 * Device state stored in RoborockService for each device.
 * Manages cleaning areas, routines, and area index mappings.
 */
export interface DeviceState {
  /** Supported cleaning areas (rooms) for the device */
  supportedAreas?: ServiceArea.Area[];
  /** Supported cleaning routines/scenes for the device */
  supportedRoutines?: ServiceArea.Area[];
  /** Currently selected area IDs for cleaning */
  selectedAreas?: number[];
  /** Mapping between area IDs and room IDs */
  areaIndexMap?: RoomIndexMap;
}

/**
 * Result of attempting to start routine-based cleaning.
 * Indicates if routine was handled and provides filtered room selection.
 */
export interface RoutineStartResult {
  /** Whether a routine was successfully started */
  handled: boolean;
  /** Remaining room selections after filtering out routine IDs */
  filteredSelection: number[];
}
