import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getRandomFingerprint } from "../src/anti-detect/fingerprints.js";

describe("getRandomFingerprint", () => {
  it("returns valid fingerprint objects", () => {
    const fp = getRandomFingerprint();
    assert.ok(fp.userAgent.includes("Chrome"));
    assert.ok(fp.viewport.width > 0);
    assert.ok(fp.viewport.height > 0);
    assert.ok(fp.locale);
    assert.ok(fp.timezone);
    assert.ok(fp.platform);
  });

  it("produces different fingerprints across calls", () => {
    const fp1 = getRandomFingerprint();
    const fp2 = getRandomFingerprint();
    assert.notDeepEqual(fp1, fp2);
  });
});
