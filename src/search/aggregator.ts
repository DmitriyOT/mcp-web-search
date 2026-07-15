import { config } from "../config.js";
import type { SearchOptions, SearchResult } from "../types.js";
import { CircuitBreaker, MemoryCache, metrics, Semaphore, TokenBucket } from "../utils/index.js";
import type { SearchProvider } from "./base.js";
import { BingProvider } from "./bing.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { SerperProvider } from "./serper.js";

const RATE_LIMITS: Record<string, number> = {
  serper: config.serperRateLimit,
  bing: config.bingRateLimit,
  duckduckgo: config.duckduckgoRateLimit,
};

export class SearchAggregator {
  private providers: SearchProvider[];
  private breakers: Map<string, CircuitBreaker>;
  private buckets: Map<string, TokenBucket>;
  private cache: MemoryCache<SearchResult[]>;
  private semaphore: Semaphore;

  constructor(providers?: SearchProvider[]) {
    this.providers = providers ?? [
      new SerperProvider(),
      new BingProvider(),
      new DuckDuckGoProvider(),
    ];
    this.breakers = new Map(
      this.providers.map((p) => [
        p.name,
        new CircuitBreaker(p.name, { failureThreshold: 3, recoveryTimeoutMs: 60000 }),
      ])
    );
    this.buckets = new Map(
      this.providers.map((p) => [
        p.name,
        new TokenBucket(RATE_LIMITS[p.name] ?? 10, RATE_LIMITS[p.name] ?? 10),
      ])
    );
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
        return this.queryProvider(provider, options);
      }

      if (config.searchMergeMode === "merge") {
        return this.searchMerge(options);
      }
      return this.searchFallback(options);
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  private async queryProvider(
    provider: SearchProvider,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const breaker = this.breakers.get(provider.name)!;
    const bucket = this.buckets.get(provider.name)!;
    const end = metrics.recordProviderStart(provider.name);
    try {
      const results = await breaker.run(async () => {
        await bucket.consume();
        return provider.search(options);
      });
      return dedupeResults(results);
    } catch (err) {
      metrics.recordProviderError(provider.name);
      throw err;
    } finally {
      end();
    }
  }

  private async searchFallback(options: SearchOptions): Promise<SearchResult[]> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const results = await this.queryProvider(provider, options);
        if (results.length > 0) {
          return results;
        }
      } catch (err) {
        errors.push(`${provider.name}: ${(err as Error).message}`);
      }
    }
    throw new Error(`All search providers failed: ${errors.join("; ")}`);
  }

  private async searchMerge(options: SearchOptions): Promise<SearchResult[]> {
    const query = options.query || "";
    const errors: string[] = [];
    const settled = await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          return await this.queryProvider(provider, options);
        } catch (err) {
          errors.push(`${provider.name}: ${(err as Error).message}`);
          return [];
        }
      })
    );

    const merged: SearchResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        merged.push(...outcome.value);
      }
    }

    const ranked = rankResults(dedupeResults(merged), query);
    const limit = options.numResults ?? 10;
    const limited = ranked.slice(0, limit);
    if (limited.length === 0) {
      throw new Error(`All search providers failed: ${errors.join("; ")}`);
    }
    return limited;
  }

  health(): Array<{
    name: string;
    available: boolean;
    circuitState: string;
    rateLimit: number;
  }> {
    return this.providers.map((p) => ({
      name: p.name,
      available: p.isAvailable(),
      circuitState: this.breakers.get(p.name)!.getState(),
      rateLimit: RATE_LIMITS[p.name] ?? 10,
    }));
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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

function rankResults(results: SearchResult[], query: string): SearchResult[] {
  const terms = new Set(tokenize(query));
  if (terms.size === 0) return results;

  const scored = results.map((r) => {
    const titleTokens = tokenize(r.title);
    const snippetTokens = tokenize(r.snippet);
    const urlTokens = tokenize(r.url);
    let score = 0;
    for (const term of terms) {
      if (titleTokens.includes(term)) score += 3;
      if (snippetTokens.includes(term)) score += 2;
      if (urlTokens.includes(term)) score += 1;
    }
    // Prefer results with a date for recency-aware queries.
    if (r.date) score += 0.5;
    // Slight preference for premium providers by order.
    const providerRank = r.source === "serper" ? 0 : r.source === "bing" ? 1 : 2;
    score -= providerRank * 0.1;
    return { result: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.result);
}
