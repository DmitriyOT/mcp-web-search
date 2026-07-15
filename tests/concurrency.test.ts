import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Semaphore } from "../src/utils/concurrency.js";

describe("Semaphore", () => {
  it("limits concurrent executions", async () => {
    const semaphore = new Semaphore(2);
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 5 }, async () => {
      await semaphore.run(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 20));
        running--;
      });
    });

    await Promise.all(tasks);
    assert.equal(maxRunning, 2);
    assert.equal(running, 0);
  });
});
