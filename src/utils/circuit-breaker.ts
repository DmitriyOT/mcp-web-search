export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  halfOpenMaxCalls?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(
    public readonly name: string,
    private options: CircuitBreakerOptions = {}
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > (this.options.recoveryTimeoutMs ?? 30000)) {
        this.state = "half-open";
        this.halfOpenCalls = 0;
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    if (this.state === "half-open" && this.halfOpenCalls >= (this.options.halfOpenMaxCalls ?? 1)) {
      throw new Error(`Circuit breaker is half-open for ${this.name}, no more trial calls allowed`);
    }

    if (this.state === "half-open") {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
    this.halfOpenCalls = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= (this.options.failureThreshold ?? 5)) {
      this.state = "open";
    }
  }
}
