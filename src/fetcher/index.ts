import { config } from "../config.js";
import type { FetchedContent, FetchOptions } from "../types.js";
import {
  isAllowedByRobotsTxt,
  isAllowedUrl,
  logger,
  MemoryCache,
  PersistentCache,
  withRetry,
} from "../utils/index.js";
import { browserManager } from "./browser.js";
import { extractFromHtml, formatForLLM } from "./extractor.js";
import { extractTextFromPdf } from "./pdf.js";

const memoryCache = new MemoryCache<FetchedContent>(config.cacheTtl * 1000);
const persistentCache = config.cacheDir
  ? new PersistentCache<FetchedContent>(config.cacheDir)
  : null;

export async function fetchUrl(options: FetchOptions): Promise<FetchedContent> {
  if (!isAllowedUrl(options.url)) {
    throw new Error(`URL not allowed: ${options.url}`);
  }

  if (config.robotsTxtEnabled && !(await isAllowedByRobotsTxt(options.url))) {
    throw new Error(`URL disallowed by robots.txt: ${options.url}`);
  }

  const cacheKey = options.url;
  const cached = memoryCache.get(cacheKey) ?? (await persistentCache?.get(cacheKey));
  if (cached) {
    logger.debug("fetch_url cache hit", { url: options.url });
    return cached;
  }

  return withRetry(
    async () => {
      const contentType = await probeContentType(options.url);

      if (contentType.includes("application/pdf")) {
        const result = await fetchPdf(options);
        memoryCache.set(cacheKey, result);
        await persistentCache?.set(cacheKey, result, config.cacheTtl * 1000);
        return result;
      }

      if (!contentType.includes("text/html")) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

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
        if (config.scrollToBottom) {
          await browserManager.scrollToBottom(managed.page);
        }
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

async function probeContentType(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(config.requestTimeout),
    });
    return response.headers.get("content-type") || "";
  } catch {
    // Fall back to GET probe if HEAD is not supported
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: AbortSignal.timeout(config.requestTimeout),
      });
      return response.headers.get("content-type") || "";
    } catch {
      return "text/html";
    }
  }
}

async function fetchPdf(options: FetchOptions): Promise<FetchedContent> {
  const response = await fetch(options.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(config.requestTimeout),
  });

  if (!response.ok) {
    throw new Error(`PDF fetch failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > config.maxResponseSizeBytes) {
    throw new Error(`PDF too large: ${buffer.length} bytes (max ${config.maxResponseSizeBytes})`);
  }

  const text = await extractTextFromPdf(buffer);
  const maxLength = options.maxLength ?? config.maxContentLength;
  const content =
    text.length > maxLength ? text.slice(0, maxLength).trim() + "\n\n[Content truncated...]" : text;

  return {
    url: options.url,
    title: options.url,
    content,
    metadata: {},
  };
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
