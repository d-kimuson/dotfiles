export type Clock = {
  readonly now: () => Date;
};

const defaultFixedTestDateIso = '2026-01-01T00:00:00.000Z';

export const dateFromIsoString = (value: string): Date => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${value}`);
  }

  return date;
};

export const systemClock = {
  now: (): Date => new Date(),
} satisfies Clock;

export const createFixedClock = (fixedDate: Date): Clock => {
  const fixedDateIso = fixedDate.toISOString();

  return {
    now: (): Date => dateFromIsoString(fixedDateIso),
  };
};

export const defaultFixedTestDate = (): Date => dateFromIsoString(defaultFixedTestDateIso);

let activeClock: Clock = systemClock;

export const currentDate = (): Date => activeClock.now();

export const currentTimestamp = (): string => currentDate().toISOString();

export const setClockForTest = (clock: Clock): (() => void) => {
  const previousClock = activeClock;
  activeClock = clock;

  return () => {
    activeClock = previousClock;
  };
};

export const setFixedDateForTest = (fixedDate: Date): (() => void) =>
  setClockForTest(createFixedClock(fixedDate));

export const resetClockForTest = (): void => {
  activeClock = createFixedClock(defaultFixedTestDate());
};

export const restoreSystemClock = (): void => {
  activeClock = systemClock;
};
