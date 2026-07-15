import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Search providers
  serperApiKey: process.env.SERPER_API_KEY || "",
  bingApiKey: process.env.BING_API_KEY || "",
  
  // Anti-detect
  stealthEnabled: process.env.STEALTH_ENABLED !== "false",
  headless: process.env.HEADLESS !== "false",
  proxyList: (process.env.PROXY_LIST || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean),
  
  // Browser
  userDataDir: process.env.USER_DATA_DIR || undefined,
  
  // Limits
  maxResults: parseInt(process.env.MAX_RESULTS || "10", 10),
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || "8000", 10),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000", 10),
  cacheTtl: parseInt(process.env.CACHE_TTL || "300", 10),
  
  // Behavior
  minDelay: parseInt(process.env.MIN_DELAY || "500", 10),
  maxDelay: parseInt(process.env.MAX_DELAY || "3000", 10),
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || "2", 10),
} as const;
