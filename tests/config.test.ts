import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("uses defaults for empty env", () => {
    const cfg = parseConfig({});
    assert.equal(cfg.serperApiKey, "");
    assert.equal(cfg.bingApiKey, "");
    assert.equal(cfg.maxResults, 10);
    assert.equal(cfg.maxContentLength, 8000);
    assert.equal(cfg.requestTimeout, 30000);
    assert.equal(cfg.cacheTtl, 300);
    assert.equal(cfg.minDelay, 500);
    assert.equal(cfg.maxDelay, 3000);
    assert.equal(cfg.maxConcurrent, 2);
    assert.equal(cfg.stealthEnabled, true);
    assert.equal(cfg.headless, true);
    assert.equal(cfg.allowInsecureBrowserFlags, false);
    assert.deepEqual(cfg.proxyList, []);
  });

  it("parses boolean env vars", () => {
    const cfg = parseConfig({
      STEALTH_ENABLED: "false",
      HEADLESS: "false",
      ALLOW_INSECURE_BROWSER_FLAGS: "true",
    });
    assert.equal(cfg.stealthEnabled, false);
    assert.equal(cfg.headless, false);
    assert.equal(cfg.allowInsecureBrowserFlags, true);
  });

  it("parses proxy list", () => {
    const cfg = parseConfig({ PROXY_LIST: "http://p1:8080, http://p2:8080" });
    assert.deepEqual(cfg.proxyList, ["http://p1:8080", "http://p2:8080"]);
  });

  it("throws on invalid positive integer", () => {
    assert.throws(() => parseConfig({ MAX_RESULTS: "abc" }), /positive integer/);
    assert.throws(() => parseConfig({ MAX_RESULTS: "0" }), /positive integer/);
    assert.throws(() => parseConfig({ MAX_RESULTS: "-5" }), /positive integer/);
  });
});
