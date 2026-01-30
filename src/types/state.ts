/**
 * State management and runtime type definitions.
 */

import type { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomIndexMap } from '../core/application/models/index.js';

/**
 * Device state stored in RoborockService for each device.
 * Manages cleaning areas, routines, and area index mappings.
 */
export interface DeviceState {
  supportedAreas?: ServiceArea.Area[];
  supportedRoutines?: ServiceArea.Area[];
  selectedAreas?: number[];
  areaIndexMap?: RoomIndexMap;
}

/**
 * Result of attempting to start routine-based cleaning.
 * Indicates if routine was handled and provides filtered room selection.
 */
export interface RoutineStartResult {
  handled: boolean;
  filteredSelection: number[];
}
