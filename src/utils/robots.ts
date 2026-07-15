import robotsParser from "robots-parser";

import { logger } from "./logger.js";

const cache = new Map<string, ReturnType<typeof robotsParser>>();

export async function isAllowedByRobotsTxt(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

    let robots = cache.get(robotsUrl);
    if (!robots) {
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": "mcp-web-search/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      const text = response.ok ? await response.text() : "";
      robots = robotsParser(robotsUrl, text);
      cache.set(robotsUrl, robots);
    }

    return robots.isAllowed(url, "mcp-web-search") !== false;
  } catch (err) {
    logger.warn("Failed to check robots.txt", { url, error: String(err) });
    // If we can't check, allow by default
    return true;
  }
}
