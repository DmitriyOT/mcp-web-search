export interface ProviderMetrics {
  requests: number;
  errors: number;
  totalLatencyMs: number;
}

export interface FetchMetrics {
  requests: number;
  errors: number;
  cacheHits: number;
  totalLatencyMs: number;
}

class MetricsCollector {
  private providers = new Map<string, ProviderMetrics>();
  private fetch: FetchMetrics = { requests: 0, errors: 0, cacheHits: 0, totalLatencyMs: 0 };

  recordProviderStart(name: string): () => void {
    this.initProvider(name);
    const start = performance.now();
    return () => {
      const m = this.providers.get(name)!;
      m.requests++;
      m.totalLatencyMs += performance.now() - start;
    };
  }

  recordProviderError(name: string) {
    this.initProvider(name);
    this.providers.get(name)!.errors++;
  }

  recordFetchStart(): () => void {
    const start = performance.now();
    return () => {
      this.fetch.requests++;
      this.fetch.totalLatencyMs += performance.now() - start;
    };
  }

  recordFetchError() {
    this.fetch.errors++;
  }

  recordFetchCacheHit() {
    this.fetch.cacheHits++;
  }

  snapshot() {
    const providers: Record<string, ProviderMetrics> = {};
    for (const [name, m] of this.providers) {
      providers[name] = { ...m };
    }
    return {
      fetch: { ...this.fetch },
      providers,
    };
  }

  private initProvider(name: string) {
    if (!this.providers.has(name)) {
      this.providers.set(name, { requests: 0, errors: 0, totalLatencyMs: 0 });
    }
  }
}

export const metrics = new MetricsCollector();
