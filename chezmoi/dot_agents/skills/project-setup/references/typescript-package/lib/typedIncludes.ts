export const typedIncludes = <const T extends unknown>(
  array: readonly T[],
  value: unknown,
  // oxlint-disable-next-line no-unsafe-type-assertion
): value is T => (array as unknown[]).includes(value);
