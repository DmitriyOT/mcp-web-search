import { unwatchFile,watchFile } from "node:fs";

import { config, ENV_FILE, reloadConfig } from "../config.js";
import { logger } from "./logger.js";

let watching = false;

export function startHotReload(): void {
  if (watching) return;
  if (process.env.NODE_ENV === "test") return;
  try {
    watchFile(ENV_FILE, { interval: 2000 }, () => {
      try {
        reloadConfig();
        logger.info("Config reloaded", { source: ENV_FILE });
      } catch (err) {
        logger.error("Failed to reload config", { error: String(err) });
      }
    });
    watching = true;
  } catch {
    // Ignore if the env file does not exist.
  }
}

export function stopHotReload(): void {
  if (!watching) return;
  try {
    unwatchFile(ENV_FILE);
  } catch {
    // Ignore if unwatch fails.
  } finally {
    watching = false;
  }
}

export { config, reloadConfig };
