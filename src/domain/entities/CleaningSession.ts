import { ValidationError } from '../../errors/index.js';

/**
 * Status of a cleaning session.
 */
export enum CleaningStatus {
  NotStarted = 'NotStarted',
  InProgress = 'InProgress',
  Paused = 'Paused',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

/**
 * Type of cleaning operation.
 */
export enum CleaningType {
  Global = 'Global', // Clean entire accessible area
  Room = 'Room', // Clean specific rooms
  Routine = 'Routine', // Execute predefined routine/scene
  Spot = 'Spot', // Spot cleaning
  Zone = 'Zone', // Zone cleaning
}

/**
 * Represents a cleaning session/operation.
 * Tracks the state and progress of a cleaning task.
 */
export class CleaningSession {
  private _status: CleaningStatus;
  private _startedAt?: Date;
  private _completedAt?: Date;
  private _pausedAt?: Date;
  private _cleanedArea?: number; // in square meters
  private _cleaningDuration?: number; // in seconds

  constructor(
    public readonly sessionId: string,
    public readonly duid: string,
    public readonly type: CleaningType,
    public readonly selectedRooms?: number[],
    public readonly routineId?: number,
  ) {
    this._status = CleaningStatus.NotStarted;
  }

  /**
   * Current status of the session.
   */
  get status(): CleaningStatus {
    return this._status;
  }

  /**
   * When the session started (if started).
   */
  get startedAt(): Date | undefined {
    return this._startedAt;
  }

  /**
   * When the session completed (if completed).
   */
  get completedAt(): Date | undefined {
    return this._completedAt;
  }

  /**
   * When the session was paused (if paused).
   */
  get pausedAt(): Date | undefined {
    return this._pausedAt;
  }

  /**
   * Total area cleaned in square meters (if available).
   */
  get cleanedArea(): number | undefined {
    return this._cleanedArea;
  }

  /**
   * Total cleaning duration in seconds (if available).
   */
  get cleaningDuration(): number | undefined {
    return this._cleaningDuration;
  }

  /**
   * Start the cleaning session.
   * @throws {ValidationError} If session is not in NotStarted state
   */
  start(): void {
    if (this._status !== CleaningStatus.NotStarted) {
      throw new ValidationError(`Cannot start session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.InProgress;
    this._startedAt = new Date();
  }

  /**
   * Pause the cleaning session.
   * @throws {ValidationError} If session is not in InProgress state
   */
  pause(): void {
    if (this._status !== CleaningStatus.InProgress) {
      throw new ValidationError(`Cannot pause session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.Paused;
    this._pausedAt = new Date();
  }

  /**
   * Resume a paused session.
   * @throws {ValidationError} If session is not in Paused state
   */
  resume(): void {
    if (this._status !== CleaningStatus.Paused) {
      throw new ValidationError(`Cannot resume session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.InProgress;
    this._pausedAt = undefined;
  }

  /**
   * Mark session as completed.
   * @param cleanedArea - Total area cleaned in square meters
   * @param duration - Total cleaning duration in seconds
   * @throws {ValidationError} If session is not in InProgress state
   */
  complete(cleanedArea?: number, duration?: number): void {
    if (this._status !== CleaningStatus.InProgress) {
      throw new ValidationError(`Cannot complete session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.Completed;
    this._completedAt = new Date();
    this._cleanedArea = cleanedArea;
    this._cleaningDuration = duration;
  }

  /**
   * Mark session as failed.
   * @throws {ValidationError} If session is already in terminal state
   */
  fail(): void {
    if (this._status === CleaningStatus.Completed || this._status === CleaningStatus.Cancelled) {
      throw new ValidationError(`Cannot fail session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.Failed;
    this._completedAt = new Date();
  }

  /**
   * Cancel the session.
   * @throws {ValidationError} If session is already in terminal state
   */
  cancel(): void {
    if (this._status === CleaningStatus.Completed || this._status === CleaningStatus.Failed) {
      throw new ValidationError(`Cannot cancel session in ${this._status} state`, {
        sessionId: this.sessionId,
        currentStatus: this._status,
      });
    }
    this._status = CleaningStatus.Cancelled;
    this._completedAt = new Date();
  }

  /**
   * Check if session is active (in progress or paused).
   */
  get isActive(): boolean {
    return this._status === CleaningStatus.InProgress || this._status === CleaningStatus.Paused;
  }

  /**
   * Check if session is in terminal state (completed, failed, or cancelled).
   */
  get isTerminal(): boolean {
    return this._status === CleaningStatus.Completed || this._status === CleaningStatus.Failed || this._status === CleaningStatus.Cancelled;
  }

  /**
   * Get elapsed time since session started (in seconds).
   */
  getElapsedTime(): number | undefined {
    if (!this._startedAt) {
      return undefined;
    }

    const endTime = this._completedAt ?? new Date();
    return Math.floor((endTime.getTime() - this._startedAt.getTime()) / 1000);
  }

  /**
   * Convert entity to plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      duid: this.duid,
      type: this.type,
      status: this._status,
      selectedRooms: this.selectedRooms,
      routineId: this.routineId,
      startedAt: this._startedAt?.toISOString(),
      completedAt: this._completedAt?.toISOString(),
      pausedAt: this._pausedAt?.toISOString(),
      cleanedArea: this._cleanedArea,
      cleaningDuration: this._cleaningDuration,
      elapsedTime: this.getElapsedTime(),
    };
  }
}
