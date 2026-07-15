import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CircuitBreaker } from "../src/utils/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("closes after successes", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 3 });
    await cb.run(async () => "ok");
    assert.equal(cb.getState(), "closed");
  });

  it("opens after threshold failures", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 2 });
    await assert.rejects(
      cb.run(async () => {
        throw new Error("fail");
      })
    );
    await assert.rejects(
      cb.run(async () => {
        throw new Error("fail");
      })
    );
    assert.equal(cb.getState(), "open");
    await assert.rejects(
      cb.run(async () => "ok"),
      /Circuit breaker is open/
    );
  });

  it("recovers after timeout", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, recoveryTimeoutMs: 50 });
    await assert.rejects(
      cb.run(async () => {
        throw new Error("fail");
      })
    );
    assert.equal(cb.getState(), "open");
    await new Promise((r) => setTimeout(r, 60));
    const result = await cb.run(async () => "recovered");
    assert.equal(result, "recovered");
    assert.equal(cb.getState(), "closed");
  });
});
