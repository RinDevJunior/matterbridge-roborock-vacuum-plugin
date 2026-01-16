import { InvalidParameterError } from '../../errors/index.js';

/**
 * Value object representing 2D coordinates.
 * Immutable representation of X/Y position.
 */
export class Coordinates {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    this.validate(x, y);
  }

  /**
   * Validate coordinates are finite numbers.
   * @throws {InvalidParameterError} If coordinates are not valid numbers
   */
  private validate(x: number, y: number): void {
    if (!Number.isFinite(x)) {
      throw new InvalidParameterError('x', x, 'X coordinate must be a finite number');
    }
    if (!Number.isFinite(y)) {
      throw new InvalidParameterError('y', y, 'Y coordinate must be a finite number');
    }
  }

  /**
   * Calculate distance to another coordinate point.
   * Uses Euclidean distance formula: √((x2-x1)² + (y2-y1)²)
   */
  distanceTo(other: Coordinates): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate Manhattan distance to another coordinate point.
   * Manhattan distance: |x2-x1| + |y2-y1|
   */
  manhattanDistanceTo(other: Coordinates): number {
    return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
  }

  /**
   * Add another coordinate (vector addition).
   */
  add(other: Coordinates): Coordinates {
    return new Coordinates(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtract another coordinate (vector subtraction).
   */
  subtract(other: Coordinates): Coordinates {
    return new Coordinates(this.x - other.x, this.y - other.y);
  }

  /**
   * Multiply by scalar value.
   */
  multiplyBy(scalar: number): Coordinates {
    return new Coordinates(this.x * scalar, this.y * scalar);
  }

  /**
   * Check equality with another Coordinates.
   */
  equals(other: Coordinates): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Check if coordinates are within a bounding box.
   */
  isWithinBounds(minX: number, minY: number, maxX: number, maxY: number): boolean {
    return this.x >= minX && this.x <= maxX && this.y >= minY && this.y <= maxY;
  }

  /**
   * Convert to string representation "(x, y)".
   */
  toString(): string {
    return `(${this.x}, ${this.y})`;
  }

  /**
   * Convert to JSON representation.
   */
  toJSON(): Record<string, number> {
    return { x: this.x, y: this.y };
  }

  /**
   * Create Coordinates from x and y values (factory method).
   */
  static from(x: number, y: number): Coordinates {
    return new Coordinates(x, y);
  }

  /**
   * Create Coordinates at origin (0, 0).
   */
  static origin(): Coordinates {
    return new Coordinates(0, 0);
  }

  /**
   * Create Coordinates from object with x and y properties.
   */
  static fromObject(obj: { x: number; y: number }): Coordinates {
    return new Coordinates(obj.x, obj.y);
  }
}

/**
 * Value object representing a rectangular area/zone.
 */
export class BoundingBox {
  constructor(
    public readonly topLeft: Coordinates,
    public readonly bottomRight: Coordinates,
  ) {
    this.validate();
  }

  /**
   * Validate bounding box has positive width and height.
   * @throws {InvalidParameterError} If bottom-right is not actually bottom-right of top-left
   */
  private validate(): void {
    if (this.bottomRight.x <= this.topLeft.x) {
      throw new InvalidParameterError('bottomRight.x', this.bottomRight.x, 'Must be greater than topLeft.x');
    }
    if (this.bottomRight.y <= this.topLeft.y) {
      throw new InvalidParameterError('bottomRight.y', this.bottomRight.y, 'Must be greater than topLeft.y');
    }
  }

  /**
   * Get width of bounding box.
   */
  get width(): number {
    return this.bottomRight.x - this.topLeft.x;
  }

  /**
   * Get height of bounding box.
   */
  get height(): number {
    return this.bottomRight.y - this.topLeft.y;
  }

  /**
   * Get area of bounding box.
   */
  get area(): number {
    return this.width * this.height;
  }

  /**
   * Get center point of bounding box.
   */
  get center(): Coordinates {
    return new Coordinates((this.topLeft.x + this.bottomRight.x) / 2, (this.topLeft.y + this.bottomRight.y) / 2);
  }

  /**
   * Check if a point is within this bounding box.
   */
  contains(point: Coordinates): boolean {
    return point.isWithinBounds(this.topLeft.x, this.topLeft.y, this.bottomRight.x, this.bottomRight.y);
  }

  /**
   * Check if this bounding box intersects with another.
   */
  intersects(other: BoundingBox): boolean {
    return !(this.bottomRight.x < other.topLeft.x || this.topLeft.x > other.bottomRight.x || this.bottomRight.y < other.topLeft.y || this.topLeft.y > other.bottomRight.y);
  }

  /**
   * Convert to JSON representation.
   */
  toJSON(): Record<string, unknown> {
    return {
      topLeft: this.topLeft.toJSON(),
      bottomRight: this.bottomRight.toJSON(),
      width: this.width,
      height: this.height,
      area: this.area,
    };
  }

  /**
   * Create BoundingBox from coordinates (factory method).
   */
  static from(topLeft: Coordinates, bottomRight: Coordinates): BoundingBox {
    return new BoundingBox(topLeft, bottomRight);
  }

  /**
   * Create BoundingBox from individual coordinates.
   */
  static fromCoordinates(x1: number, y1: number, x2: number, y2: number): BoundingBox {
    return new BoundingBox(new Coordinates(x1, y1), new Coordinates(x2, y2));
  }
}
