# Lean differential test: reference implementation

A reference for writing the differential test of `docs/guidelines/quality-assurance/lean-spec.md` in a repository's own language. It is TypeScript with node:test and fast-check; in another language, keep the structure and use that language's test runner and PBT library.

## Structure

- A shared part starts `spec-oracle` once per test process, sends one JSON line per call, reads one line back, and fails on `{"error": …}` or a missing binary.
- Each differential test generates inputs within the range the Lean types and constraints allow, plus inputs aimed at the spec's boundaries, converts them to the JSON shape of the Lean side, and compares the implementation's result with the spec's.

## Shared part

```ts
// spec/oracle.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";

const BINARY = ".lake/build/bin/spec-oracle";

export const startOracle = () => {
  if (!existsSync(BINARY)) throw new Error(`${BINARY} is missing; run \`lake build\``);
  const child = spawn(BINARY);
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  return {
    evaluate: async (fn: string, args: unknown): Promise<unknown> => {
      child.stdin.write(`${JSON.stringify({ fn, args })}\n`);
      const output = JSON.parse((await lines.next()).value);
      if (typeof output === "object" && output !== null && "error" in output) throw new Error(`spec-oracle: ${output.error}`);
      return output;
    },
    close: () => child.stdin.end(),
  };
};
```

## A differential test

The spec has `CartTotal.total` (the sum of `price * quantity`) and `CartTotal.shipping` (0 when the total is 5000 or more, otherwise 500). Random carts almost never total exactly 5000, so the test also generates carts at the threshold and one off it; with only uniform carts, an implementation that uses `>` instead of `>=` passed 10 runs out of 10, and with the boundary carts it failed 10 out of 10.

```ts
// src/cart/shipping.oracle.test.ts
import { after, test } from "node:test";
import fc from "fast-check";

import { startOracle } from "../../spec/oracle.ts";
import { shipping, total } from "./cart-total.ts";

const oracle = startOracle();
after(() => oracle.close());

// Lean `Nat`: non-negative integers, bounded so the implementation's number stays exact
const line = fc.record({ price: fc.nat(10_000), quantity: fc.nat(100) });

// Carts whose total is the spec's threshold (5000) or one off it: random lines, then one line that fills the gap
const nearThreshold = fc
  .tuple(fc.array(line, { maxLength: 3 }), fc.integer({ min: -1, max: 1 }))
  .map(([lines, offset]) => {
    const gap = 5000 + offset - total(lines);
    return gap >= 0 ? [...lines, { price: gap, quantity: 1 }] : lines;
  });

test("shipping agrees with the spec", async () => {
  await fc.assert(
    fc.asyncProperty(fc.oneof(fc.array(line), nearThreshold), async (lines) => {
      const spec = await oracle.evaluate("CartTotal.shipping", lines);
      const actual = shipping(lines);
      if (actual !== spec) throw new Error(`implementation ${actual}, spec ${JSON.stringify(spec)}`);
    }),
  );
});
```

fast-check shrinks a failing input and prints it as the counterexample (`[[{"price":5000,"quantity":1}]]` with `implementation 500, spec 0` for the `>` bug).
