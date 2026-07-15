import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function levelFromEnv(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVELS) return env as LogLevel;
  return "info";
}

export interface LogContext {
  requestId?: string;
}

const logContext = new AsyncLocalStorage<LogContext>();

class Logger {
  private level = levelFromEnv();

  runWithRequestId<T>(fn: () => T): T {
    return logContext.run({ requestId: randomUUID() }, fn);
  }

  getRequestId(): string | undefined {
    return logContext.getStore()?.requestId;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;
    const context = logContext.getStore();
    const entry = {
      level,
      message,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(meta ? { meta } : {}),
    };
    // Use stderr to avoid polluting stdio MCP transport
    console.error(JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  }
}

export const logger = new Logger();
