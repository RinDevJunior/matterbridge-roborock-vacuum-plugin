import { ValidationError, InvalidParameterError } from '../../errors/index.js';

/**
 * Area type classification.
 */
export enum AreaType {
  Room = 'Room', // Individual room
  Zone = 'Zone', // Custom zone/area
  Segment = 'Segment', // Map segment
}

/**
 * Value object representing a cleanable area.
 * Immutable representation of an area that can be selected for cleaning.
 */
export class CleaningArea {
  constructor(
    public readonly areaId: number,
    public readonly name: string,
    public readonly type: AreaType = AreaType.Room,
  ) {
    this.validateAreaId(areaId);
    this.validateName(name);
  }

  /**
   * Validate area ID is positive.
   * @throws {InvalidParameterError} If area ID is not positive
   */
  private validateAreaId(areaId: number): void {
    if (areaId <= 0) {
      throw new InvalidParameterError('areaId', areaId, 'Area ID must be a positive integer');
    }
  }

  /**
   * Validate area name is not empty.
   * @throws {ValidationError} If name is empty
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Area name cannot be empty', {
        areaId: this.areaId,
      });
    }
  }

  /**
   * Check if this is a room area.
   */
  get isRoom(): boolean {
    return this.type === AreaType.Room;
  }

  /**
   * Check if this is a zone area.
   */
  get isZone(): boolean {
    return this.type === AreaType.Zone;
  }

  /**
   * Check if this is a segment area.
   */
  get isSegment(): boolean {
    return this.type === AreaType.Segment;
  }

  /**
   * Get display label with type.
   */
  getDisplayLabel(): string {
    return `${this.name} (${this.type})`;
  }

  /**
   * Check equality with another CleaningArea.
   */
  equals(other: CleaningArea): boolean {
    return this.areaId === other.areaId && this.type === other.type;
  }

  /**
   * Check if this area matches the given ID.
   */
  matchesId(id: number): boolean {
    return this.areaId === id;
  }

  /**
   * Convert to JSON representation.
   */
  toJSON(): Record<string, unknown> {
    return {
      areaId: this.areaId,
      name: this.name,
      type: this.type,
    };
  }

  /**
   * Create CleaningArea for a room (factory method).
   */
  static forRoom(areaId: number, name: string): CleaningArea {
    return new CleaningArea(areaId, name, AreaType.Room);
  }

  /**
   * Create CleaningArea for a zone (factory method).
   */
  static forZone(areaId: number, name: string): CleaningArea {
    return new CleaningArea(areaId, name, AreaType.Zone);
  }

  /**
   * Create CleaningArea for a segment (factory method).
   */
  static forSegment(areaId: number, name: string): CleaningArea {
    return new CleaningArea(areaId, name, AreaType.Segment);
  }
}

/**
 * Collection of cleaning areas with selection operations.
 */
export class CleaningAreaCollection {
  private readonly areas: Map<number, CleaningArea>;

  constructor(areas: CleaningArea[]) {
    this.areas = new Map(areas.map((area) => [area.areaId, area]));
  }

  /**
   * Get area by ID.
   */
  getById(areaId: number): CleaningArea | undefined {
    return this.areas.get(areaId);
  }

  /**
   * Get all areas.
   */
  getAll(): CleaningArea[] {
    return Array.from(this.areas.values());
  }

  /**
   * Get areas by IDs.
   */
  getByIds(areaIds: number[]): CleaningArea[] {
    return areaIds.map((id) => this.areas.get(id)).filter((area): area is CleaningArea => area !== undefined);
  }

  /**
   * Get all room areas.
   */
  getRooms(): CleaningArea[] {
    return this.getAll().filter((area) => area.isRoom);
  }

  /**
   * Get all zone areas.
   */
  getZones(): CleaningArea[] {
    return this.getAll().filter((area) => area.isZone);
  }

  /**
   * Check if collection contains area with given ID.
   */
  has(areaId: number): boolean {
    return this.areas.has(areaId);
  }

  /**
   * Get number of areas in collection.
   */
  get count(): number {
    return this.areas.size;
  }

  /**
   * Check if collection is empty.
   */
  get isEmpty(): boolean {
    return this.areas.size === 0;
  }

  /**
   * Filter areas by type.
   */
  filterByType(type: AreaType): CleaningArea[] {
    return this.getAll().filter((area) => area.type === type);
  }

  /**
   * Convert to JSON representation.
   */
  toJSON(): Record<string, unknown>[] {
    return this.getAll().map((area) => area.toJSON());
  }
}
