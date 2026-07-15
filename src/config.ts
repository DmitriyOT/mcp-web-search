import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
