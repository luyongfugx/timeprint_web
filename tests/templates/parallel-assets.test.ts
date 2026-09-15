import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { mapAssetBatches } from "../../src/lib/templates/parallel-assets";

test("asset batches preserve ordering and cap concurrent work at three", async () => {
  let active = 0,
    peak = 0;
  const values = [0, 1, 2, 3, 4, 5, 6];
  const result = await mapAssetBatches(values, async (value) => {
    peak = Math.max(peak, ++active);
    await setImmediate();
    active--;
    return value * 2;
  });
  assert.deepEqual(
    result,
    values.map((value) => value * 2),
  );
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.deepEqual(await mapAssetBatches([], async () => 0), []);
});

test("failure drains in-flight work and prevents subsequent batches", async () => {
  const started: number[] = [],
    finished: number[] = [];
  const failure = new Error("COS unavailable");
  await assert.rejects(
    mapAssetBatches([0, 1, 2, 3], async (value) => {
      started.push(value);
      if (value === 1) throw failure;
      await setImmediate();
      finished.push(value);
      return value;
    }),
    (error) => error === failure,
  );
  assert.deepEqual(started, [0, 1, 2]);
  assert.deepEqual(finished, [0, 2]);
});
