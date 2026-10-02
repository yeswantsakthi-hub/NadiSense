import { describe, expect, it } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  it('returns samples oldest first', () => {
    const b = new RingBuffer(4);
    b.push(1, 10);
    b.push(2, 20);
    expect(b.length).toBe(2);
    expect([b.timeAt(0), b.timeAt(1)]).toEqual([1, 2]);
    expect(b.lastTime).toBe(2);
  });

  it('overwrites the oldest sample when full', () => {
    const b = new RingBuffer(3);
    for (let i = 1; i <= 5; i++) b.push(i, i * 10);
    expect(b.length).toBe(3);
    expect([0, 1, 2].map((i) => b.valueAt(i))).toEqual([30, 40, 50]);
    expect(b.lastTime).toBe(5);
  });

  it('empties on clear', () => {
    const b = new RingBuffer(3);
    b.push(1, 1);
    b.clear();
    expect(b.length).toBe(0);
    expect(b.lastTime).toBe(0);
  });
});
