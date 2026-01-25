import { Device } from '../roborockCommunication/models/index.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

/**
 * Registry for managing robot vacuum devices.
 * Provides centralized storage and lookup for Device and RoborockVacuumCleaner instances.
 */
export class DeviceRegistry {
  private readonly robots = new Map<string, RoborockVacuumCleaner>();
  private readonly devices = new Map<string, Device>();

  /**
   * Register a device and its associated robot vacuum cleaner.
   * Uses serialNumber as the key for consistency with module.ts.
   */
  public register(device: Device, robot: RoborockVacuumCleaner): void {
    if (!device?.serialNumber) return;
    this.devices.set(device.serialNumber, device);
    this.robots.set(device.serialNumber, robot);
  }

  public registerRobot(robot: RoborockVacuumCleaner): void {
    if (!robot?.serialNumber) return;
    this.robots.set(robot.serialNumber, robot);
  }

  /**
   * Register a device only (without robot).
   * Used during device discovery before robot is created.
   */
  public registerDevice(device: Device): void {
    if (!device?.serialNumber) return;
    this.devices.set(device.serialNumber, device);
  }

  /**
   * Unregister a device and its robot by serial number.
   */
  public unregister(serialNumber: string): void {
    this.devices.delete(serialNumber);
    this.robots.delete(serialNumber);
  }

  /**
   * Get a robot by serial number.
   */
  public getRobot(serialNumber: string): RoborockVacuumCleaner | undefined {
    return this.robots.get(serialNumber);
  }

  /**
   * Get a device by serial number.
   */
  public getDevice(serialNumber: string): Device | undefined {
    return this.devices.get(serialNumber);
  }

  /**
   * Get all registered robots.
   */
  public getAllRobots(): RoborockVacuumCleaner[] {
    return Array.from(this.robots.values());
  }

  /**
   * Get all registered devices.
   */
  public getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get the number of registered devices.
   */
  public get size(): number {
    return this.devices.size;
  }

  /**
   * Check if there are any registered devices.
   */
  public hasDevices(): boolean {
    return this.devices.size > 0;
  }

  /**
   * Clear all registered devices and robots.
   */
  public clear(): void {
    this.devices.clear();
    this.robots.clear();
  }

  /**
   * Iterate over all robot entries.
   */
  public *robotEntries(): IterableIterator<[string, RoborockVacuumCleaner]> {
    yield* this.robots.entries();
  }

  /**
   * Iterate over all device entries.
   */
  public *deviceEntries(): IterableIterator<[string, Device]> {
    yield* this.devices.entries();
  }

  // Expose maps for backward compatibility
  public get robotsMap(): Map<string, RoborockVacuumCleaner> {
    return this.robots;
  }

  public get devicesMap(): Map<string, Device> {
    return this.devices;
  }
}
