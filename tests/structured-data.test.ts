import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractFromHtml } from "../src/fetcher/extractor.js";

describe("extractFromHtml structured data & links", () => {
  it("extracts JSON-LD structured data", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Test"}</script>
        <script type="application/ld+json">not valid json</script>
      </head><body><article><p>Content</p></article></body></html>
    `;
    const result = extractFromHtml("https://example.com/page", html);
    assert.equal(result.metadata.structuredData?.length, 1);
    assert.deepEqual(result.metadata.structuredData?.[0], {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Test",
    });
  });

  it("extracts page links when requested", () => {
    const html = `
      <html><body>
        <article>
          <a href="/a">Link A</a>
          <a href="https://example.com/b">Link B</a>
          <a href="/a">Duplicate</a>
        </article>
      </body></html>
    `;
    const result = extractFromHtml("https://example.com/page", html, { includeLinks: true });
    assert.equal(result.metadata.links?.length, 2);
    assert.equal(result.metadata.links?.[0].text, "Link A");
    assert.equal(result.metadata.links?.[0].url, "https://example.com/a");
    assert.equal(result.metadata.links?.[1].text, "Link B");
  });

  it("post-processes markdown by removing empty links", () => {
    const html = `<html><body><p><a href="/x"></a> <a href="#">click</a> text</p></body></html>`;
    const result = extractFromHtml("https://example.com/page", html);
    assert.doesNotMatch(result.content, /\[\]\(/);
    assert.match(result.content, /text/);
  });
});
