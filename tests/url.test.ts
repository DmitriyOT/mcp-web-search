import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedUrl } from "../src/utils/url.js";

describe("isAllowedUrl", () => {
  it("allows http/https URLs", () => {
    assert.equal(isAllowedUrl("https://example.com/path?q=1"), true);
    assert.equal(isAllowedUrl("http://example.com"), true);
  });

  it("rejects non-http protocols", () => {
    assert.equal(isAllowedUrl("file:///etc/passwd"), false);
    assert.equal(isAllowedUrl("javascript:alert(1)"), false);
    assert.equal(isAllowedUrl("data:text/html,<script>"), false);
  });

  it("rejects localhost and private IPs", () => {
    assert.equal(isAllowedUrl("http://localhost:8080"), false);
    assert.equal(isAllowedUrl("http://127.0.0.1"), false);
    assert.equal(isAllowedUrl("http://192.168.1.1"), false);
    assert.equal(isAllowedUrl("http://10.0.0.1"), false);
    assert.equal(isAllowedUrl("http://172.16.0.1"), false);
  });

  it("rejects malformed URLs", () => {
    assert.equal(isAllowedUrl("not a url"), false);
  });
});
