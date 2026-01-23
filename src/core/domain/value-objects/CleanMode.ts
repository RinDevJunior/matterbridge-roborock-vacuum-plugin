/**
 * Value object representing a vacuum clean mode.
 * Uses type-safe enumeration pattern with predefined instances.
 */
export class CleanMode {
  /** Vacuum only mode */
  public static readonly Vacuum = new CleanMode('vacuum');

  /** Mop only mode */
  public static readonly Mop = new CleanMode('mop');

  /** Vacuum and mop combined mode */
  public static readonly VacuumAndMop = new CleanMode('vacuum_and_mop');

  /** Sweep mode */
  public static readonly Sweep = new CleanMode('sweep');

  private constructor(public readonly value: string) {}

  /**
   * Create a CleanMode from a string value.
   * Returns a predefined instance if it matches, otherwise creates a new one.
   */
  public static fromString(mode: string): CleanMode {
    const normalized = mode.toLowerCase().trim();

    switch (normalized) {
      case 'vacuum':
        return CleanMode.Vacuum;
      case 'mop':
        return CleanMode.Mop;
      case 'vacuum_and_mop':
      case 'vacuumandmop':
        return CleanMode.VacuumAndMop;
      case 'sweep':
        return CleanMode.Sweep;
      default:
        return new CleanMode(normalized);
    }
  }

  /**
   * Get the string representation of this clean mode.
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Check if two CleanModes are equal.
   */
  public equals(other: CleanMode): boolean {
    return this.value === other.value;
  }
}
