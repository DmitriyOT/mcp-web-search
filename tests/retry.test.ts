import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/utils/retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(async () => "ok", { retries: 2 });
    assert.equal(result, "ok");
  });

  it("retries on failure and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    }, { retries: 3, minDelay: 10, maxDelay: 20 });
    assert.equal(result, "ok");
    assert.equal(attempts, 3);
  });

  it("throws after exhausting retries", async () => {
    let attempts = 0;
    await assert.rejects(
      withRetry(async () => {
        attempts++;
        throw new Error("fail");
      }, { retries: 2, minDelay: 10, maxDelay: 20 }),
      /fail/
    );
    assert.equal(attempts, 3); // initial + 2 retries
  });

  it("respects shouldRetry predicate", async () => {
    let attempts = 0;
    await assert.rejects(
      withRetry(async () => {
        attempts++;
        throw new Error("skip");
      }, {
        retries: 3,
        minDelay: 10,
        maxDelay: 20,
        shouldRetry: (err) => !err.message.includes("skip"),
      }),
      /skip/
    );
    assert.equal(attempts, 1);
  });
});
