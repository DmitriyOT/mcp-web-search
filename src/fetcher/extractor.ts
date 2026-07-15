import type { FetchedContent } from "../types.js";

export function extractFromHtml(url: string, html: string): FetchedContent {
  const title = extractTag(html, "title") || extractTag(html, "h1") || url;
  const description = extractMeta(html, "description") || extractMeta(html, "og:description");
  const author = extractMeta(html, "author") || extractMeta(html, "article:author");
  const keywords = extractMeta(html, "keywords");
  const date = extractMeta(html, "article:published_time") || extractMeta(html, "datePublished");

  // Remove scripts, styles, nav, footer, aside, header
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Try to get article/main content first
  let contentHtml = extractTagContent(cleaned, "article") ||
    extractTagContent(cleaned, "main") ||
    extractTagContent(cleaned, "[role='main']") ||
    cleaned;

  // Convert to plain text
  let text = htmlToText(contentHtml);

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return {
    url,
    title: stripTags(title),
    content: text,
    metadata: {
      description: description ? stripTags(description) : undefined,
      author: author ? stripTags(author) : undefined,
      keywords: keywords ? stripTags(keywords) : undefined,
      date: date ? stripTags(date).split("T")[0] : undefined,
    },
  };
}

function extractTag(html: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(html);
  return match?.[1];
}

function extractMeta(html: string, name: string): string | undefined {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  let m = regex.exec(html);
  if (!m) {
    const altRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escapeRegex(name)}["']`,
      "i"
    );
    m = altRegex.exec(html);
  }
  return m?.[1];
}

function extractTagContent(html: string, selector: string): string | undefined {
  if (selector.startsWith("[")) {
    const attr = selector.slice(1, -1);
    const regex = new RegExp(`<[^>]+${escapeRegex(attr)}[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
    const m = regex.exec(html);
    return m?.[1];
  }
  return extractTag(html, selector);
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, (m) => {
      try {
        return String.fromCharCode(parseInt(m.slice(2, -1), 10));
      } catch {
        return m;
      }
    });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
