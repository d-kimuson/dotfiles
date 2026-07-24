import { beforeEach } from 'vitest';

import { resetClockForTest } from '../../src/lib/clock.ts';

beforeEach(() => {
  resetClockForTest();
});
