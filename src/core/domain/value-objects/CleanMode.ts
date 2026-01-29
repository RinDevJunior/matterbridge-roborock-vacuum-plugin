/**
 * Value object representing a vacuum clean mode.
 * Uses type-safe enumeration pattern with predefined instances.
 */
export class CleanMode {
  public static readonly Vacuum = new CleanMode('vacuum');
  public static readonly Mop = new CleanMode('mop');
  public static readonly VacuumAndMop = new CleanMode('vacuum_and_mop');

  private constructor(private readonly value: string) {}

  public static fromString(mode: string): CleanMode {
    const normalized = mode.toLowerCase().trim();

    switch (normalized) {
      case 'vacuum':
        return CleanMode.Vacuum;
      case 'mop':
        return CleanMode.Mop;
      case 'vacuum_and_mop':
        return CleanMode.VacuumAndMop;
      default:
        return new CleanMode(normalized);
    }
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: CleanMode): boolean {
    return this.value === other.value;
  }
}
