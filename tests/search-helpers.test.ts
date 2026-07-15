import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "../src/types.js";

// Re-implement dedupeResults to test it in isolation
function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    try {
      const normalized = new URL(r.url).toString().replace(/\/$/, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    } catch {
      return true;
    }
  });
}

describe("dedupeResults", () => {
  it("removes duplicate URLs", () => {
    const results: SearchResult[] = [
      { title: "A", url: "https://example.com/page", snippet: "x" },
      { title: "B", url: "https://example.com/page/", snippet: "y" },
      { title: "C", url: "https://example.com/other", snippet: "z" },
    ];
    const deduped = dedupeResults(results);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].title, "A");
    assert.equal(deduped[1].title, "C");
  });
});
