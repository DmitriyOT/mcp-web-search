import { SearchProvider } from "./base.js";
import type { SearchResult, SearchOptions } from "../types.js";

export class DuckDuckGoProvider extends SearchProvider {
  name = "duckduckgo";

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const num = Math.min(options.numResults || 10, 30);
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", options.query);
    url.searchParams.set("kl", "us-en");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": this.getRandomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
      },
    });

    if (!res.ok) {
      throw new Error(`DuckDuckGo search failed: ${res.status}`);
    }

    const html = await res.text();
    return this.parseHtml(html, num);
  }

  private parseHtml(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && links.length < limit) {
      const rawUrl = m[1];
      const title = this.stripTags(m[2]).trim();
      let url = rawUrl;
      if (url.startsWith("//")) url = "https:" + url;
      else if (url.startsWith("/")) url = "https://duckduckgo.com" + url;
      
      // DuckDuckGo often wraps external links
      const ddgu = new URL(url, "https://duckduckgo.com");
      if (ddgu.hostname === "duckduckgo.com" && ddgu.searchParams.has("uddg")) {
        url = decodeURIComponent(ddgu.searchParams.get("uddg")!);
      }
      
      links.push({ url, title });
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < limit) {
      snippets.push(this.stripTags(m[1]).trim());
    }

    for (let i = 0; i < links.length; i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || "",
        source: "DuckDuckGo",
      });
    }

    return results;
  }

  private stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  private getRandomUA(): string {
    const uas = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    ];
    return uas[Math.floor(Math.random() * uas.length)];
  }
}
