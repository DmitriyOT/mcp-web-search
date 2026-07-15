import { SearchProvider } from "./base.js";
import { config } from "../config.js";
import type { SearchResult, SearchOptions } from "../types.js";

export class BingProvider extends SearchProvider {
  name = "bing";

  isAvailable(): boolean {
    return !!config.bingApiKey;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error("Bing API key not configured");
    }

    const num = Math.min(options.numResults || 10, 50);
    const url = new URL("https://api.bing.microsoft.com/v7.0/search");
    url.searchParams.set("q", options.query);
    url.searchParams.set("count", num.toString());
    url.searchParams.set("mkt", "en-US");
    url.searchParams.set("responseFilter", "Webpages");

    if (options.recencyDays) {
      const date = new Date();
      date.setDate(date.getDate() - options.recencyDays);
      url.searchParams.set("freshness", `DateRange_${date.toISOString().split("T")[0]}..`);
    }

    const res = await fetch(url.toString(), {
      headers: {
        "Ocp-Apim-Subscription-Key": config.bingApiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Bing search failed: ${res.status}`);
    }

    const data = await res.json() as {
      webPages?: {
        value: Array<{
          name: string;
          url: string;
          snippet: string;
          dateLastCrawled?: string;
        }>;
      };
    };

    return (data.webPages?.value || []).map((r) => ({
      title: r.name,
      url: r.url,
      snippet: r.snippet,
      date: r.dateLastCrawled ? r.dateLastCrawled.split("T")[0] : undefined,
      source: "Bing",
    }));
  }
}
