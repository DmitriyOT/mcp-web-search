import { SearchProvider } from "./base.js";
import { config } from "../config.js";
import type { SearchResult, SearchOptions } from "../types.js";

export class SerperProvider extends SearchProvider {
  name = "serper";

  isAvailable(): boolean {
    return !!config.serperApiKey;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error("Serper API key not configured");
    }

    const num = Math.min(options.numResults || 10, 100);
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": config.serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: options.query,
        num,
        hl: "en",
        gl: "us",
      }),
    });

    if (!res.ok) {
      throw new Error(`Serper search failed: ${res.status}`);
    }

    const data = await res.json() as {
      organic?: Array<{
        title: string;
        link: string;
        snippet: string;
        date?: string;
      }>;
    };

    return (data.organic || []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      date: r.date,
      source: "Serper/Google",
    }));
  }
}
