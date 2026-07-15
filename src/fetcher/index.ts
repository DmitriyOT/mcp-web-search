import { browserManager } from "./browser.js";
import { extractFromHtml, formatForLLM } from "./extractor.js";
import { config } from "../config.js";
import { isAllowedUrl, withRetry } from "../utils/index.js";
import type { FetchedContent, FetchOptions } from "../types.js";

export async function fetchUrl(options: FetchOptions): Promise<FetchedContent> {
  if (!isAllowedUrl(options.url)) {
    throw new Error(`URL not allowed: ${options.url}`);
  }

  return withRetry(
    async () => {
      const page = await browserManager.newPage();
      try {
        await browserManager.randomDelay();
        const response = await page.goto(options.url, {
          waitUntil: "networkidle2",
          timeout: config.requestTimeout,
        });

        if (!response) {
          throw new Error("No response from page");
        }

        if (response.status() >= 400) {
          throw new Error(`HTTP ${response.status()}`);
        }

        await browserManager.humanLikeScroll(page);
        await browserManager.randomDelay();

        const html = await page.content();
        return extractFromHtml(options.url, html, {
          includeImages: options.includeImages,
          maxLength: options.maxLength ?? config.maxContentLength,
        });
      } finally {
        await page.close();
      }
    },
    {
      retries: 2,
      minDelay: config.minDelay,
      maxDelay: config.maxDelay,
      shouldRetry: (err) => {
        const msg = err.message.toLowerCase();
        return msg.includes("timeout") || msg.includes("navigation") || msg.includes("net::");
      },
    }
  );
}

export { extractFromHtml, formatForLLM };
