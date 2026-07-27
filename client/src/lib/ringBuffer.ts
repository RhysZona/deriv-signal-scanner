/**
 * RingBuffer — fixed-size circular buffer.
 *
 * Used for the dual-window tick storage (Section 4.3):
 * - Slow window: 1000 ticks (fixed)
 * - Fast window: user-adjustable, min 10
 *
 * push() is O(1) — no shift() jank at tick-level update frequency.
 */

export class RingBuffer<T> {
  private buf: T[];
  private head: number;
  public count: number;
  public readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.buf = new Array<T>(size);
    this.head = 0;
    this.count = 0;
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  /** Returns items oldest → newest. */
  toArray(): T[] {
    if (this.count < this.size) {
      return this.buf.slice(0, this.count);
    }
    return [
      ...this.buf.slice(this.head),
      ...this.buf.slice(0, this.head),
    ];
  }

  /** Peek at the newest item, or undefined if empty. */
  peek(): T | undefined {
    if (this.count === 0) return undefined;
    return this.buf[this.head === 0 ? this.size - 1 : this.head - 1];
  }

  /** Access item at index (0 = oldest, count-1 = newest). */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    if (this.count < this.size) return this.buf[index];
    return this.buf[(this.head + index) % this.size];
  }

  /** Create a new RingBuffer seeded from the tail of this one. Used when resizing. */
  resize(newSize: number): RingBuffer<T> {
    const current = this.toArray();
    const tail = current.slice(Math.max(0, current.length - newSize));
    const nb = new RingBuffer<T>(newSize);
    for (const item of tail) nb.push(item);
    return nb;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
