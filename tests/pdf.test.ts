import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractTextFromPdf } from "../src/fetcher/pdf.js";

describe("extractTextFromPdf", () => {
  it("exports extractor function", () => {
    assert.equal(typeof extractTextFromPdf, "function");
  });
});
