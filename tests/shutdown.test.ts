import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shutdownManager } from "../src/utils/shutdown.js";

describe("shutdownManager", () => {
  it("tracks active requests and waits for drain", async () => {
    assert.equal(shutdownManager.isShuttingDown(), false);

    const end1 = shutdownManager.beginRequest();
    const end2 = shutdownManager.beginRequest();

    let resolved = false;
    shutdownManager.shutdown().then(() => {
      resolved = true;
    });

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(resolved, false);

    end1();
    end2();

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(resolved, true);
    assert.equal(shutdownManager.isShuttingDown(), true);
  });

  it("rejects new requests after shutdown starts", async () => {
    await shutdownManager.shutdown();
    assert.throws(() => shutdownManager.beginRequest(), /shutting down/);
  });
});
