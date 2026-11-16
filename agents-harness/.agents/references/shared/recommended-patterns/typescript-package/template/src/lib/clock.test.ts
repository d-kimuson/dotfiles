import { describe, expect, test } from 'vitest';

import {
  currentTimestamp,
  dateFromIsoString,
  defaultFixedTestDate,
  setFixedDateForTest,
} from './clock.ts';

describe('clock', () => {
  test('uses the default fixed test date via time.setup.ts', () => {
    expect(currentTimestamp()).toBe(defaultFixedTestDate().toISOString());
  });

  test('setFixedDateForTest overrides and restores the clock', () => {
    const restore = setFixedDateForTest(dateFromIsoString('2030-05-06T07:08:09.000Z'));
    expect(currentTimestamp()).toBe('2030-05-06T07:08:09.000Z');

    restore();
    expect(currentTimestamp()).toBe(defaultFixedTestDate().toISOString());
  });

  test('dateFromIsoString rejects invalid input', () => {
    expect(() => dateFromIsoString('not-a-date')).toThrow('Invalid ISO date string');
  });
});
