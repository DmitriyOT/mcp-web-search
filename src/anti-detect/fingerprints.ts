export interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezone: string;
  colorDepth: number;
  deviceScaleFactor: number;
  platform: string;
  oscpu?: string;
}

const fingerprints: Fingerprint[] = [
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezone: "America/New_York",
    colorDepth: 24,
    deviceScaleFactor: 1,
    platform: "Win32",
    oscpu: "Windows NT 10.0; Win64; x64",
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezone: "America/Chicago",
    colorDepth: 24,
    deviceScaleFactor: 1,
    platform: "Win32",
    oscpu: "Windows NT 10.0; Win64; x64",
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1680, height: 1050 },
    locale: "en-US",
    timezone: "America/Los_Angeles",
    colorDepth: 30,
    deviceScaleFactor: 2,
    platform: "MacIntel",
  },
  {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-GB",
    timezone: "Europe/London",
    colorDepth: 24,
    deviceScaleFactor: 1,
    platform: "Linux x86_64",
  },
];

export function getRandomFingerprint(): Fingerprint {
  return fingerprints[Math.floor(Math.random() * fingerprints.length)];
}
