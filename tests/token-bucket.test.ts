import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TokenBucket } from "../src/utils/token-bucket.js";

describe("TokenBucket", () => {
  it("allows requests up to capacity without delay", async () => {
    const bucket = new TokenBucket(3, 10);
    const start = Date.now();
    await bucket.consume();
    await bucket.consume();
    await bucket.consume();
    assert.ok(Date.now() - start < 50);
  });

  it("delays when capacity is exceeded", async () => {
    const bucket = new TokenBucket(1, 20);
    await bucket.consume();
    const start = Date.now();
    await bucket.consume();
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `expected delay, got ${elapsed}ms`);
  });

  it("refills over time", async () => {
    const bucket = new TokenBucket(1, 50);
    await bucket.consume();
    await new Promise((r) => setTimeout(r, 60));
    const start = Date.now();
    await bucket.consume();
    assert.ok(Date.now() - start < 50);
  });
});
