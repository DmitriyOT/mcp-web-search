import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MemoryCache } from "../src/utils/cache.js";

describe("MemoryCache", () => {
  it("stores and retrieves values", () => {
    const cache = new MemoryCache<string>(1000);
    cache.set("key", "value");
    assert.equal(cache.get("key"), "value");
  });

  it("expires values after TTL", async () => {
    const cache = new MemoryCache<string>(50);
    cache.set("key", "value");
    assert.equal(cache.get("key"), "value");
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(cache.get("key"), undefined);
  });
});
