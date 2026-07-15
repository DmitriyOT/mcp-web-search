import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import type { FetchedContent } from "../types.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Remove noisy elements
turndown.remove([
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "aside",
  "header",
  "form",
  "button",
  "input",
  "select",
  "textarea",
]);

const NOISE_SELECTORS = [
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[class*="consent"]',
  '[id*="consent"]',
  '[class*="gdpr"]',
  '[id*="gdpr"]',
  '[class*="newsletter"]',
  '[id*="newsletter"]',
  '[class*="popup"]',
  '[id*="popup"]',
  '[class*="modal"]',
  '[id*="modal"]',
  '[class*="overlay"]',
  '[class*="ad"]',
  '[id*="ad"]',
  '[class*="social"]',
  '[class*="share"]',
];

export interface ExtractOptions {
  includeImages?: boolean;
  maxLength?: number;
}

export function extractFromHtml(
  url: string,
  html: string,
  options: ExtractOptions = {}
): FetchedContent {
  const { document, window } = parseHTML(html);

  const title =
    document.querySelector("title")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    url;

  const getMeta = (name: string): string | undefined => {
    const selectors = [
      `meta[name="${name}"]`,
      `meta[property="${name}"]`,
      `meta[http-equiv="${name}"]`,
    ];
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute("content");
      if (value) return value.trim();
    }
    return undefined;
  };

  const description = getMeta("description") || getMeta("og:description");
  const author = getMeta("author") || getMeta("article:author");
  const keywords = getMeta("keywords");
  const date =
    getMeta("article:published_time") || getMeta("datePublished") || getMeta("published_time");

  // Remove noise before scoring
  for (const selector of NOISE_SELECTORS) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      el.remove();
    }
  }

  const contentRoot = findContentRoot(document);
  let content = contentRoot ? turndown.turndown(contentRoot.innerHTML).trim() : "";

  if (options.includeImages) {
    const images = collectImages(contentRoot, url);
    if (images.length) {
      content += "\n\n## Images\n\n" + images.map((img) => `- ${img}`).join("\n");
    }
  }

  content = content
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (options.maxLength && content.length > options.maxLength) {
    content = content.slice(0, options.maxLength).trim() + "\n\n[Content truncated...]";
  }

  window?.close?.();

  return {
    url,
    title,
    content,
    metadata: {
      description,
      author,
      keywords,
      date: date ? date.split("T")[0] : undefined,
    },
  };
}

function findContentRoot(document: Document): Element | null {
  // Prefer semantic markers
  const semantic =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector('[role="main"]');
  if (semantic) return semantic;

  // Readability-like scoring
  let best: Element | null = document.body;
  let bestScore = 0;

  for (const el of Array.from(document.querySelectorAll("div, section"))) {
    const text = el.textContent || "";
    const textLength = text.trim().length;
    if (textLength < 200) continue;

    const linkText = Array.from(el.querySelectorAll("a"))
      .map((a) => a.textContent || "")
      .join("").length;
    const linkDensity = textLength > 0 ? linkText / textLength : 0;

    const paragraphs = el.querySelectorAll("p").length;
    const commas = (text.match(/,/g) || []).length;

    const score = textLength * (1 - linkDensity) + paragraphs * 100 + commas * 10;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

function collectImages(root: Element | null, pageUrl: string): string[] {
  if (!root) return [];
  const seen = new Set<string>();
  const images: string[] = [];
  for (const img of Array.from(root.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src");
    if (!src) continue;
    try {
      const absolute = new URL(src, pageUrl).toString();
      if (!seen.has(absolute)) {
        seen.add(absolute);
        images.push(absolute);
      }
    } catch {
      // ignore malformed URLs
    }
  }
  return images;
}

export function formatForLLM(results: FetchedContent[]): string {
  return results
    .map((r, i) => {
      const metaParts: string[] = [];
      if (r.metadata.date) metaParts.push(`Date: ${r.metadata.date}`);
      if (r.metadata.author) metaParts.push(`Author: ${r.metadata.author}`);
      if (r.metadata.description) metaParts.push(`Description: ${r.metadata.description}`);

      let out = `--- Result ${i + 1} ---\n`;
      out += `Title: ${r.title}\n`;
      out += `URL: ${r.url}\n`;
      if (metaParts.length) out += metaParts.join(" | ") + "\n";
      out += `\n${r.content}\n`;
      return out;
    })
    .join("\n");
}
