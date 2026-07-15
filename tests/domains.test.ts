import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseConfig } from "../src/config.js";

describe("domain allowlist/blocklist", () => {
  it("parses allowed and blocked domains", () => {
    const cfg = parseConfig({
      ALLOWED_DOMAINS: "example.com, example.org",
      BLOCKED_DOMAINS: "bad.example.com, evil.com",
    });
    assert.deepEqual(cfg.allowedDomains, ["example.com", "example.org"]);
    assert.deepEqual(cfg.blockedDomains, ["bad.example.com", "evil.com"]);
  });

  it("defaults to empty lists", () => {
    const cfg = parseConfig({});
    assert.deepEqual(cfg.allowedDomains, []);
    assert.deepEqual(cfg.blockedDomains, []);
  });
});
