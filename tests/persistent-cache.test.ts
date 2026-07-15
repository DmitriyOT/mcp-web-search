import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { PersistentCache } from "../src/utils/persistent-cache.js";

describe("PersistentCache", () => {
  let dir: string;

  it("stores and retrieves values", async () => {
    dir = mkdtempSync(join(tmpdir(), "mcp-cache-"));
    const cache = new PersistentCache<{ data: string }>(dir);
    await cache.set("key", { data: "value" }, 1000);
    const result = await cache.get("key");
    assert.deepEqual(result, { data: "value" });
  });

  it("expires values", async () => {
    dir = mkdtempSync(join(tmpdir(), "mcp-cache-"));
    const cache = new PersistentCache<{ data: string }>(dir);
    await cache.set("key", { data: "value" }, 50);
    assert.deepEqual(await cache.get("key"), { data: "value" });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await cache.get("key"), undefined);
  });

  it("returns undefined for missing keys", async () => {
    dir = mkdtempSync(join(tmpdir(), "mcp-cache-"));
    const cache = new PersistentCache<unknown>(dir);
    assert.equal(await cache.get("missing"), undefined);
  });

  it.afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
});
