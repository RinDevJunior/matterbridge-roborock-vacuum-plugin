export default class Sequence {
  private readonly min: number;
  private readonly max: number;
  private current: number;

  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
    this.current = min;
  }

  next(): number {
    if (this.current > this.max) {
      this.current = this.min;
    }
    return this.current++;
  }
}
