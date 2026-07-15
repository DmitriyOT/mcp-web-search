import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { metrics } from "../src/utils/metrics.js";

describe("MetricsCollector", () => {
  it("records provider latency and errors", () => {
    const end = metrics.recordProviderStart("serper");
    end();
    metrics.recordProviderError("serper");

    const snapshot = metrics.snapshot();
    const provider = snapshot.providers.serper;
    assert.equal(provider.requests, 1);
    assert.equal(provider.errors, 1);
    assert.ok(provider.totalLatencyMs >= 0);
  });

  it("records fetch metrics", async () => {
    const end = metrics.recordFetchStart();
    await new Promise((r) => setTimeout(r, 10));
    end();
    metrics.recordFetchError();
    metrics.recordFetchCacheHit();

    const snapshot = metrics.snapshot();
    assert.equal(snapshot.fetch.requests, 1);
    assert.equal(snapshot.fetch.errors, 1);
    assert.equal(snapshot.fetch.cacheHits, 1);
    assert.ok(snapshot.fetch.totalLatencyMs >= 10);
  });
});
