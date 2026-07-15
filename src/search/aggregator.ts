import { config } from "../config.js";
import type { SearchOptions, SearchResult } from "../types.js";
import { MemoryCache, Semaphore } from "../utils/index.js";
import type { SearchProvider } from "./base.js";
import { BingProvider } from "./bing.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { SerperProvider } from "./serper.js";

export class SearchAggregator {
  private providers: SearchProvider[];
  private cache: MemoryCache<SearchResult[]>;
  private semaphore: Semaphore;

  constructor(providers?: SearchProvider[]) {
    this.providers = providers ?? [
      new SerperProvider(),
      new BingProvider(),
      new DuckDuckGoProvider(),
    ];
    this.cache = new MemoryCache<SearchResult[]>(config.cacheTtl * 1000);
    this.semaphore = new Semaphore(config.maxConcurrent);
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const cacheKey = this.cacheKey(options);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const providerName = options.provider || "auto";

    const result = await this.semaphore.run(async () => {
      if (providerName !== "auto") {
        const provider = this.providers.find((p) => p.name === providerName);
        if (!provider) {
          throw new Error(`Unknown provider: ${providerName}`);
        }
        return dedupeResults(await provider.search(options));
      }

      // Auto: try premium APIs first, fallback to DuckDuckGo
      const errors: string[] = [];
      for (const provider of this.providers) {
        try {
          const results = await provider.search(options);
          if (results.length > 0) {
            return dedupeResults(results);
          }
        } catch (err) {
          errors.push(`${provider.name}: ${(err as Error).message}`);
        }
      }

      throw new Error(`All search providers failed: ${errors.join("; ")}`);
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  private cacheKey(options: SearchOptions): string {
    return JSON.stringify({
      q: options.query,
      n: options.numResults,
      p: options.provider,
      r: options.recencyDays,
    });
  }
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    try {
      const normalized = new URL(r.url).toString().replace(/\/$/, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    } catch {
      return true;
    }
  });
}
