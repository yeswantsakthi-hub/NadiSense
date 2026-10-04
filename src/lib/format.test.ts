import { describe, expect, it } from 'vitest';
import { ago, duration } from './format';

describe('format', () => {
  it('describes how long ago something happened', () => {
    expect(ago(0, 12_000)).toBe('12s ago');
    expect(ago(0, 4 * 60_000 + 5_000)).toBe('4m ago');
    expect(ago(0, 2 * 3_600_000)).toBe('2h ago');
    expect(ago(5_000, 0)).toBe('0s ago');
  });

  it('formats elapsed time', () => {
    expect(duration(7_000)).toBe('0:07');
    expect(duration(4 * 60_000 + 7_000)).toBe('4:07');
    expect(duration(3_600_000 + 2 * 60_000 + 9_000)).toBe('1:02:09');
  });
});
