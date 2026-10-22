/** Fixed-size (time, value) buffer for high-rate streams; overwrites the oldest sample when full. */
export class RingBuffer {
  readonly capacity: number;
  private readonly times: Float64Array;
  private readonly values: Float64Array;
  private head = 0;
  private count = 0;
  /** performance.now() when the latest sample was pushed; lets the canvas scroll smoothly between packets. */
  lastPushAt = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.times = new Float64Array(capacity);
    this.values = new Float64Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  push(t: number, v: number): void {
    const i = (this.head + this.count) % this.capacity;
    this.times[i] = t;
    this.values[i] = v;
    if (this.count < this.capacity) this.count++;
    else this.head = (this.head + 1) % this.capacity;
    this.lastPushAt = performance.now();
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  /** Index 0 is the oldest sample, `length - 1` the newest. */
  timeAt(i: number): number {
    return this.times[(this.head + i) % this.capacity]!;
  }

  valueAt(i: number): number {
    return this.values[(this.head + i) % this.capacity]!;
  }

  get lastTime(): number {
    return this.count ? this.timeAt(this.count - 1) : 0;
  }
}
