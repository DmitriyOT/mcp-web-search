import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, describe, it } from "node:test";

import { config } from "../src/config.js";
import { extractFromHtml } from "../src/fetcher/extractor.js";
import { SearchAggregator } from "../src/search/aggregator.js";
import { SearchProvider } from "../src/search/base.js";
import type { SearchOptions, SearchResult } from "../src/types.js";

class StubProvider extends SearchProvider {
  name: string;
  private results: SearchResult[];
  private shouldFail: boolean;

  constructor(name: string, results: SearchResult[], shouldFail = false) {
    super();
    this.name = name;
    this.results = results;
    this.shouldFail = shouldFail;
  }

  async search(_options: SearchOptions): Promise<SearchResult[]> {
    if (this.shouldFail) throw new Error("stub failure");
    return this.results;
  }
}

describe("SearchAggregator integration", () => {
  it("returns results from the first successful provider", async () => {
    const aggregator = new SearchAggregator([
      new StubProvider("serper", []),
      new StubProvider("bing", [
        { title: "Bing Result", url: "https://example.com", snippet: "hello" },
      ]),
      new StubProvider("duckduckgo", [
        { title: "DDG Result", url: "https://example.org", snippet: "world" },
      ]),
    ]);

    const results = await aggregator.search({ query: "test" });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Bing Result");
  });

  it("falls back when all previous providers fail", async () => {
    const aggregator = new SearchAggregator([
      new StubProvider("serper", [], true),
      new StubProvider("bing", [], true),
      new StubProvider("duckduckgo", [
        { title: "DDG Result", url: "https://example.com", snippet: "fallback" },
      ]),
    ]);

    const results = await aggregator.search({ query: "test" });
    assert.equal(results[0].title, "DDG Result");
  });

  it("throws when all providers fail", async () => {
    const aggregator = new SearchAggregator([
      new StubProvider("serper", [], true),
      new StubProvider("bing", [], true),
      new StubProvider("duckduckgo", [], true),
    ]);

    await assert.rejects(aggregator.search({ query: "test" }), /All search providers failed/);
  });

  it("caches results", async () => {
    let calls = 0;
    const provider = new (class extends SearchProvider {
      name = "cached";
      async search(): Promise<SearchResult[]> {
        calls++;
        return [{ title: "Cached", url: "https://example.com", snippet: "x" }];
      }
    })();

    const aggregator = new SearchAggregator([provider]);
    await aggregator.search({ query: "cache-test" });
    await aggregator.search({ query: "cache-test" });
    assert.equal(calls, 1);
  });

  describe("merge mode", () => {
    const originalMode = config.searchMergeMode;

    afterEach(() => {
      config.searchMergeMode = originalMode;
    });

    it("merges and deduplicates results from multiple providers", async () => {
      config.searchMergeMode = "merge";
      const aggregator = new SearchAggregator([
        new StubProvider("serper", [
          { title: "First", url: "https://example.com/a", snippet: "alpha" },
          { title: "Shared", url: "https://example.com/shared", snippet: "shared a" },
        ]),
        new StubProvider("bing", [
          { title: "Second", url: "https://example.com/b", snippet: "beta" },
          { title: "Shared", url: "https://example.com/shared/", snippet: "shared b" },
        ]),
      ]);

      const results = await aggregator.search({ query: "test" });
      assert.equal(results.length, 3);
      const urls = results.map((r) => r.url);
      assert.ok(urls.includes("https://example.com/a"));
      assert.ok(urls.includes("https://example.com/b"));
      assert.equal(results.filter((r) => r.title === "Shared").length, 1);
    });

    it("ranks results by query relevance", async () => {
      config.searchMergeMode = "merge";
      const aggregator = new SearchAggregator([
        new StubProvider("serper", [
          { title: "Z page", url: "https://example.com/z", snippet: "unrelated" },
        ]),
        new StubProvider("bing", [
          {
            title: "Acme banana recipes",
            url: "https://example.com/banana",
            snippet: "ripe banana",
          },
        ]),
      ]);

      const results = await aggregator.search({ query: "banana" });
      assert.equal(results[0].title, "Acme banana recipes");
    });

    it("throws when all providers fail in merge mode", async () => {
      config.searchMergeMode = "merge";
      const aggregator = new SearchAggregator([
        new StubProvider("serper", [], true),
        new StubProvider("bing", [], true),
      ]);

      await assert.rejects(aggregator.search({ query: "test" }), /All search providers failed/);
    });
  });
});

describe("extractFromHtml with server HTML", () => {
  it("extracts article content from HTML served over HTTP", async () => {
    const html = `
      <html>
        <head><title>Server Page</title></head>
        <body>
          <article>
            <h1>Article Heading</h1>
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
          </article>
        </body>
      </html>
    `;

    const server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const result = extractFromHtml(`http://127.0.0.1:${port}/page`, html);
      assert.equal(result.title, "Server Page");
      assert.match(result.content, /Article Heading/);
      assert.match(result.content, /First paragraph/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
