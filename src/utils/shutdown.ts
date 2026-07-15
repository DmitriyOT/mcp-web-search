import { logger } from "./logger.js";

class ShutdownManager {
  private activeRequests = 0;
  private shuttingDown = false;
  private onDrainCallbacks: Array<() => void> = [];

  beginRequest(): () => void {
    if (this.shuttingDown) {
      throw new Error("Server is shutting down");
    }
    this.activeRequests++;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      this.activeRequests--;
      if (this.activeRequests === 0 && this.shuttingDown) {
        this.onDrainCallbacks.forEach((cb) => cb());
        this.onDrainCallbacks = [];
      }
    };
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info("Shutting down, waiting for active requests", {
      activeRequests: this.activeRequests,
    });

    if (this.activeRequests === 0) return;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn("Shutdown timeout reached with active requests", {
          activeRequests: this.activeRequests,
        });
        resolve();
      }, 10000);

      this.onDrainCallbacks.push(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}

export const shutdownManager = new ShutdownManager();
