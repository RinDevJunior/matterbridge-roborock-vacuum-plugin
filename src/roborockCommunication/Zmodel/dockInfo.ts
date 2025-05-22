import { DockType } from '../Zenum/dockType.js';

export class DockInfo {
  private readonly dockType: DockType;

  constructor(dockType: DockType) {
    this.dockType = dockType;
  }
}
