import { browserManager } from "./browser.js";
import { extractFromHtml, formatForLLM } from "./extractor.js";
import type { FetchedContent, FetchOptions } from "../types.js";

export async function fetchUrl(options: FetchOptions): Promise<FetchedContent> {
  const page = await browserManager.newPage();
  try {
    await browserManager.randomDelay();
    const response = await page.goto(options.url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    if (!response) {
      throw new Error("No response from page");
    }

    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }

    // Random scroll to look human
    await browserManager.humanLikeScroll(page);
    await browserManager.randomDelay();

    const html = await page.content();
    const result = extractFromHtml(options.url, html);

    const maxLength = options.maxLength ?? 8000;
    if (result.content.length > maxLength) {
      result.content = result.content.slice(0, maxLength).trim() + "\n\n[Content truncated...]";
    }

    return result;
  } finally {
    await page.close();
  }
}

export { extractFromHtml, formatForLLM };
