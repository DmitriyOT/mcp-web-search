import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import pino from "pino";

import { config } from "../config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function normalizeLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  if (normalized in LEVELS) return normalized as LogLevel;
  return "info";
}

export interface LogContext {
  requestId?: string;
}

const logContext = new AsyncLocalStorage<LogContext>();

class Logger {
  private pino: pino.Logger;

  constructor() {
    this.pino = pino(
      {
        level: normalizeLevel(config.logLevel),
        base: {
          pid: process.pid,
          // Do not include hostname by default to keep stdio MCP transport clean.
        },
      },
      pino.destination(2)
    );
  }

  runWithRequestId<T>(fn: () => T): T {
    return logContext.run({ requestId: randomUUID() }, fn);
  }

  getRequestId(): string | undefined {
    return logContext.getStore()?.requestId;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[(this.pino.level as LogLevel) ?? "info"];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;
    const context = logContext.getStore();
    const child = context?.requestId
      ? this.pino.child({ requestId: context.requestId })
      : this.pino;
    child[level](meta ?? {}, message);
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
