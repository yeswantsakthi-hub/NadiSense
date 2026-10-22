import { describe, expect, it } from 'vitest';
import { duration } from './format';

describe('format', () => {
  it('formats elapsed time', () => {
    expect(duration(7_000)).toBe('0:07');
    expect(duration(4 * 60_000 + 7_000)).toBe('4:07');
    expect(duration(3_600_000 + 2 * 60_000 + 9_000)).toBe('1:02:09');
  });
});
