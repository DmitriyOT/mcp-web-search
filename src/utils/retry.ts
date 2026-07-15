export interface RetryOptions {
  retries?: number;
  minDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 2;
  const minDelay = options.minDelay ?? 500;
  const maxDelay = options.maxDelay ?? 3000;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === retries) break;
      if (options.shouldRetry && !options.shouldRetry(lastError, attempt + 1)) {
        throw lastError;
      }
      const jitter = Math.random();
      const delay = Math.min(
        minDelay * 2 ** attempt + jitter * (maxDelay - minDelay),
        maxDelay
      );
      await new Promise((resolve) => setTimeout(resolve, Math.round(delay)));
    }
  }

  throw lastError;
}
