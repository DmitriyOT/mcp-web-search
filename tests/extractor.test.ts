import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFromHtml } from "../src/fetcher/extractor.js";

describe("extractFromHtml", () => {
  it("extracts title and main content", () => {
    const html = `
      <html>
        <head><title>Test Title</title><meta name="description" content="A description"></head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Hello World</h1>
            <p>This is the article content.</p>
          </article>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const result = extractFromHtml("https://example.com/page", html);
    assert.equal(result.title, "Test Title");
    assert.equal(result.metadata.description, "A description");
    assert.match(result.content, /Hello World/);
    assert.match(result.content, /article content/);
    assert.doesNotMatch(result.content, /Navigation/);
    assert.doesNotMatch(result.content, /Footer/);
  });

  it("truncates content to maxLength", () => {
    const html = `<html><body><p>${"word ".repeat(100)}</p></body></html>`;
    const result = extractFromHtml("https://example.com/page", html, { maxLength: 50 });
    assert.ok(result.content.length <= 80); // includes truncation marker
    assert.match(result.content, /\[Content truncated\.\.\.\]/);
  });

  it("collects images when requested", () => {
    const html = `
      <html><body>
        <article>
          <img src="/pic1.png">
          <img src="https://cdn.example.com/pic2.png">
        </article>
      </body></html>
    `;
    const result = extractFromHtml("https://example.com/page", html, { includeImages: true });
    assert.match(result.content, /https:\/\/example\.com\/pic1\.png/);
    assert.match(result.content, /https:\/\/cdn\.example\.com\/pic2\.png/);
  });

  it("falls back to body when no article/main", () => {
    const html = `<html><body><p>Body content</p></body></html>`;
    const result = extractFromHtml("https://example.com/page", html);
    assert.match(result.content, /Body content/);
  });
});
