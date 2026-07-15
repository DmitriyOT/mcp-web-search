import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const ENV_FILE = process.env.ENV_FILE || ".env";

const positiveInt = (defaultValue: number) =>
  z
    .string()
    .transform((val) => {
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(`Expected positive integer, got "${val}"`);
      }
      return parsed;
    })
    .default(String(defaultValue));

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((v) => String(v).toLowerCase() !== "false");

export const configSchema = z.object({
  // Search providers
  serperApiKey: z.string().default(""),
  bingApiKey: z.string().default(""),

  // Anti-detect
  stealthEnabled: booleanFromEnv(true),
  headless: booleanFromEnv(true),
  proxyList: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    ),

  // Browser
  userDataDir: z.string().optional(),
  cacheDir: z.string().optional(),
  browserPoolSize: positiveInt(2),

  // Limits
  maxResults: positiveInt(10),
  maxContentLength: positiveInt(8000),
  maxResponseSizeBytes: positiveInt(10_000_000),
  requestTimeout: positiveInt(30000),
  cacheTtl: positiveInt(300),

  // Behavior
  minDelay: positiveInt(500),
  maxDelay: positiveInt(3000),
  maxConcurrent: positiveInt(2),
  scrollToBottom: booleanFromEnv(true),

  // Rate limits (requests per second per provider)
  serperRateLimit: positiveInt(10),
  bingRateLimit: positiveInt(10),
  duckduckgoRateLimit: positiveInt(1),

  // Search aggregation
  searchMergeMode: z.enum(["fallback", "merge"]).default("fallback"),

  // Fetch behavior
  textFetchFallback: booleanFromEnv(true),

  // Ethics / safety
  robotsTxtEnabled: booleanFromEnv(true),
  allowedDomains: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    ),
  blockedDomains: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    ),

  // Logging
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Transport
  mcpTransport: z.enum(["stdio", "http"]).default("stdio"),
  httpHost: z.string().default("127.0.0.1"),
  httpPort: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(`Expected positive integer for HTTP port, got "${val}"`);
      }
      return parsed;
    }),

  // Debug / advanced
  allowInsecureBrowserFlags: booleanFromEnv(false),
});

export type Config = z.infer<typeof configSchema>;

function envToCamelCase(
  env: Record<string, string | undefined>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  return configSchema.parse(envToCamelCase(env));
}

export const config = parseConfig(process.env);

export function reloadConfig(): void {
  dotenv.config({ path: ENV_FILE, override: true });
  const fresh = parseConfig(process.env);
  Object.assign(config, fresh);
}
