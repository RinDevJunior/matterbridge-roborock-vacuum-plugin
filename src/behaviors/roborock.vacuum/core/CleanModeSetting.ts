import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';

export class CleanModeSetting {
  public constructor(
    public readonly suctionPower: number,
    public readonly waterFlow: number,
    public readonly distance_off: number,
    public readonly mopRoute: number | undefined,
    public readonly sequenceType: number | undefined,
  ) {}

  public get hasFullSettings(): boolean {
    return this.suctionPower !== undefined && this.waterFlow !== undefined && this.mopRoute !== undefined;
  }

  public get isSmartMode(): boolean {
    return (
      this.suctionPower === VacuumSuctionPower.Smart ||
      this.waterFlow === MopWaterFlow.Smart ||
      this.mopRoute === MopRoute.Smart
    );
  }

  public get isCustomMode(): boolean {
    return (
      this.suctionPower === VacuumSuctionPower.Custom ||
      this.waterFlow === MopWaterFlow.Custom ||
      this.mopRoute === MopRoute.Custom
    );
  }
}
