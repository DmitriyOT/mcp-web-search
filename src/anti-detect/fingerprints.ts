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

const CHROME_MAJOR_VERSIONS = [126, 127, 128, 129, 130, 131];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 720 },
];

const LOCALES = [
  { locale: "en-US", timezone: "America/New_York" },
  { locale: "en-GB", timezone: "Europe/London" },
  { locale: "en-CA", timezone: "America/Toronto" },
  { locale: "en-AU", timezone: "Australia/Sydney" },
];

const PLATFORMS = [
  {
    platform: "Win32",
    oscpu: "Windows NT 10.0; Win64; x64",
    ua: (chrome: number) =>
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`,
  },
  {
    platform: "MacIntel",
    oscpu: undefined,
    ua: (chrome: number) =>
      `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`,
  },
  {
    platform: "Linux x86_64",
    oscpu: undefined,
    ua: (chrome: number) =>
      `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`,
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomFingerprint(): Fingerprint {
  const chrome = pick(CHROME_MAJOR_VERSIONS);
  const platform = pick(PLATFORMS);
  const viewport = pick(VIEWPORTS);
  const locale = pick(LOCALES);
  const deviceScaleFactor = platform.platform === "MacIntel" ? pick([1, 2]) : 1;
  const colorDepth = pick([24, 30]);

  return {
    userAgent: platform.ua(chrome),
    viewport,
    locale: locale.locale,
    timezone: locale.timezone,
    colorDepth,
    deviceScaleFactor,
    platform: platform.platform,
    oscpu: platform.oscpu,
  };
}
