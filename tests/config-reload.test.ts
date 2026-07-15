import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { config, reloadConfig } from "../src/config.js";

describe("reloadConfig", () => {
  it("mutates the existing config object with fresh values", () => {
    const original = config.cacheTtl;
    process.env.CACHE_TTL = "999";
    reloadConfig();
    assert.equal(config.cacheTtl, 999);
    process.env.CACHE_TTL = String(original);
    reloadConfig();
    assert.equal(config.cacheTtl, original);
  });
});
