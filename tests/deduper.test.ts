import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InFlightDeduper } from "../src/utils/deduper.js";

describe("InFlightDeduper", () => {
  it("coalesces identical in-flight requests", async () => {
    const deduper = new InFlightDeduper<string>();
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return "result";
    };

    const [a, b] = await Promise.all([deduper.run("key", fn), deduper.run("key", fn)]);
    assert.equal(a, "result");
    assert.equal(b, "result");
    assert.equal(calls, 1);
  });

  it("runs different keys independently", async () => {
    const deduper = new InFlightDeduper<number>();
    let calls = 0;
    const fn = async (n: number) => {
      calls++;
      return n * 2;
    };

    const [a, b] = await Promise.all([
      deduper.run("a", () => fn(1)),
      deduper.run("b", () => fn(2)),
    ]);
    assert.equal(a, 2);
    assert.equal(b, 4);
    assert.equal(calls, 2);
  });

  it("removes pending entry after rejection", async () => {
    const deduper = new InFlightDeduper<string>();
    const fn = async () => {
      throw new Error("boom");
    };

    await assert.rejects(deduper.run("key", fn));
    // A second call should execute a fresh function.
    let calls = 0;
    const result = await deduper.run("key", async () => {
      calls++;
      return "ok";
    });
    assert.equal(result, "ok");
    assert.equal(calls, 1);
  });
});
