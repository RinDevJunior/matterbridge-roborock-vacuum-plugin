import { DockType } from '../enums/index.js';

export class DockInfo {
  private readonly dockType: DockType;

  constructor(dockType: DockType) {
    this.dockType = dockType;
  }
}
