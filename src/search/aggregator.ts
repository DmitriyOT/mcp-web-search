import { DuckDuckGoProvider } from "./duckduckgo.js";
import { SerperProvider } from "./serper.js";
import { BingProvider } from "./bing.js";
import type { SearchProvider } from "./base.js";
import type { SearchResult, SearchOptions } from "../types.js";

export class SearchAggregator {
  private providers: SearchProvider[];

  constructor() {
    this.providers = [
      new SerperProvider(),
      new BingProvider(),
      new DuckDuckGoProvider(),
    ];
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const providerName = options.provider || "auto";

    if (providerName !== "auto") {
      const provider = this.providers.find((p) => p.name === providerName);
      if (!provider) {
        throw new Error(`Unknown provider: ${providerName}`);
      }
      return provider.search(options);
    }

    // Auto: try premium APIs first, fallback to DuckDuckGo
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const results = await provider.search(options);
        if (results.length > 0) {
          return results;
        }
      } catch (err) {
        errors.push(`${provider.name}: ${(err as Error).message}`);
      }
    }

    throw new Error(`All search providers failed: ${errors.join("; ")}`);
  }
}
