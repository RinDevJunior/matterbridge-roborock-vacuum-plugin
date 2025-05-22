export class ChunkBuffer {
  private buffer: Buffer = Buffer.alloc(0);

  get(): Buffer {
    return this.buffer;
  }
  reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  append(message: Buffer): void {
    if (this.buffer.length == 0) {
      this.buffer = message;
    } else {
      this.buffer = Buffer.concat([this.buffer, message]);
    }
  }
}
