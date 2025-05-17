import { DockType } from '../Zenum/dockType.js';

export default class DockInfo {
  private readonly dockType: DockType;

  constructor(dockType: DockType) {
    this.dockType = dockType;
  }
}
