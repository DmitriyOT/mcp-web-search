import { config } from "../config.js";
import type { FetchedContent, FetchOptions } from "../types.js";
import { isAllowedUrl, logger, MemoryCache, PersistentCache, withRetry } from "../utils/index.js";
import { browserManager } from "./browser.js";
import { extractFromHtml, formatForLLM } from "./extractor.js";

const memoryCache = new MemoryCache<FetchedContent>(config.cacheTtl * 1000);
const persistentCache = config.cacheDir
  ? new PersistentCache<FetchedContent>(config.cacheDir)
  : null;

export async function fetchUrl(options: FetchOptions): Promise<FetchedContent> {
  if (!isAllowedUrl(options.url)) {
    throw new Error(`URL not allowed: ${options.url}`);
  }

  const cacheKey = options.url;
  const cached = memoryCache.get(cacheKey) ?? (await persistentCache?.get(cacheKey));
  if (cached) {
    logger.debug("fetch_url cache hit", { url: options.url });
    return cached;
  }

  return withRetry(
    async () => {
      const managed = await browserManager.newIsolatedPage();
      try {
        await browserManager.randomDelay();
        const response = await managed.page.goto(options.url, {
          waitUntil: "networkidle2",
          timeout: config.requestTimeout,
        });

        if (!response) {
          throw new Error("No response from page");
        }

        if (response.status() >= 400) {
          throw new Error(`HTTP ${response.status()}`);
        }

        const headers = response.headers();
        const contentType = headers["content-type"] || "";
        if (!contentType.includes("text/html")) {
          throw new Error(`Unsupported content type: ${contentType}`);
        }

        const contentLength = headers["content-length"];
        if (contentLength && Number(contentLength) > config.maxResponseSizeBytes) {
          throw new Error(
            `Response too large: ${contentLength} bytes (max ${config.maxResponseSizeBytes})`
          );
        }

        const finalUrl = managed.page.url();
        if (!isAllowedUrl(finalUrl)) {
          throw new Error(`Redirected to disallowed URL: ${finalUrl}`);
        }

        await browserManager.humanLikeScroll(managed.page);
        await browserManager.randomDelay();

        const html = await managed.page.content();
        detectBlocking(html, finalUrl);

        const result = extractFromHtml(finalUrl, html, {
          includeImages: options.includeImages,
          includeLinks: options.includeLinks,
          maxLength: options.maxLength ?? config.maxContentLength,
        });

        memoryCache.set(cacheKey, result);
        await persistentCache?.set(cacheKey, result, config.cacheTtl * 1000);
        return result;
      } finally {
        await managed.close();
      }
    },
    {
      retries: 2,
      minDelay: config.minDelay,
      maxDelay: config.maxDelay,
      shouldRetry: (err) => {
        const msg = err.message.toLowerCase();
        return (
          msg.includes("timeout") ||
          msg.includes("navigation") ||
          msg.includes("net::") ||
          msg.includes("unsupported content type")
        );
      },
    }
  );
}

function detectBlocking(html: string, url: string) {
  const lower = html.toLowerCase();
  const blockSignals = [
    "captcha",
    "are you human",
    "are you a robot",
    "blocked",
    "access denied",
    "please verify",
    "security check",
    "cloudflare",
    "turnstile",
  ];
  const detected = blockSignals.find((signal) => lower.includes(signal));
  if (detected) {
    logger.warn("Potential blocking page detected", { url, signal: detected });
    throw new Error(`Page appears blocked or captcha-protected (${detected})`);
  }
}

export { extractFromHtml, formatForLLM };
