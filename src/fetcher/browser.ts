import puppeteer from "puppeteer";
import { addExtra, type VanillaPuppeteer } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserPreferencesPlugin from "puppeteer-extra-plugin-user-preferences";
import UserDataDirPlugin from "puppeteer-extra-plugin-user-data-dir";
import type { Browser, Page } from "puppeteer";
import { config } from "../config.js";
import { getRandomFingerprint, type Fingerprint } from "../anti-detect/fingerprints.js";

const pptr = addExtra(puppeteer as unknown as VanillaPuppeteer);

// Apply stealth plugins
if (config.stealthEnabled) {
  pptr.use(StealthPlugin());
}

pptr.use(
  UserPreferencesPlugin({
    userPrefs: {
      profile: {
        default_content_settings: { images: 2 }, // Disable images for speed
      },
      plugins: {
        always_open_pdf_externally: true,
      },
    },
  })
);

if (config.userDataDir) {
  pptr.use(UserDataDirPlugin({ userDataDir: config.userDataDir }));
}

export class BrowserManager {
  private browser: Browser | null = null;
  private currentFingerprint: Fingerprint | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
    ];

    if (config.allowInsecureBrowserFlags) {
      args.push(
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      );
    }

    if (config.proxyList.length > 0) {
      const proxy = config.proxyList[Math.floor(Math.random() * config.proxyList.length)];
      args.push(`--proxy-server=${proxy}`);
    }

    this.browser = await pptr.launch({
      headless: config.headless,
      args,
      defaultViewport: null,
    });

    return this.browser;
  }

  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const fp = getRandomFingerprint();
    this.currentFingerprint = fp;

    // Set viewport
    await page.setViewport({
      width: fp.viewport.width,
      height: fp.viewport.height,
      deviceScaleFactor: fp.deviceScaleFactor,
    });

    // Set locale / timezone
    await page.evaluateOnNewDocument((fingerprint: Fingerprint) => {
      const nav = navigator as unknown as Record<string, unknown>;

      Object.defineProperty(nav, "platform", {
        get: () => fingerprint.platform,
      });
      if (fingerprint.oscpu) {
        Object.defineProperty(nav, "oscpu", {
          get: () => fingerprint.oscpu,
        });
      }
      Object.defineProperty(nav, "hardwareConcurrency", {
        get: () => 4 + Math.floor(Math.random() * 8),
      });
      Object.defineProperty(nav, "deviceMemory", {
        get: () => 8,
      });
      Object.defineProperty(nav, "language", {
        get: () => fingerprint.locale,
      });
      Object.defineProperty(nav, "languages", {
        get: () => [fingerprint.locale, "en"],
      });

      // Override webdriver
      Object.defineProperty(nav, "webdriver", {
        get: () => undefined,
      });

      // Override permissions
      const permissions = nav.permissions as Permissions;
      const originalQuery = permissions.query.bind(permissions);
      permissions.query = async (parameters: PermissionDescriptor) => {
        const name = (parameters as { name: string }).name;
        if (
          name === "notifications" ||
          name === "clipboard-read" ||
          name === "clipboard-write"
        ) {
          return { state: "prompt", onchange: null, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true } as unknown as PermissionStatus;
        }
        return originalQuery(parameters);
      };

      // Override plugins
      Object.defineProperty(nav, "plugins", {
        get: () => [
          { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format", version: undefined, length: 1, item: () => null, namedItem: () => null },
          { name: "Native Client", filename: "internal-nacl-plugin", description: "Native Client module", version: undefined, length: 2, item: () => null, namedItem: () => null },
        ],
      });

      // Chrome runtime
      (globalThis as unknown as Record<string, unknown>).chrome = {
        runtime: {
          OnInstalledReason: { CHROME_UPDATE: "chrome_update", UPDATE: "update", INSTALL: "install" },
          OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
          PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSel: "mipsel", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSel: "mipsel", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
          RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
        },
      };
    }, fp);

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": `${fp.locale},en;q=0.9`,
      "DNT": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    return page;
  }

  async randomDelay() {
    const delay = Math.floor(
      Math.random() * (config.maxDelay - config.minDelay) + config.minDelay
    );
    await new Promise((r) => setTimeout(r, delay));
  }

  async humanLikeScroll(page: Page) {
    await page.evaluate(async () => {
      const total = Math.floor(Math.random() * 800 + 200);
      const steps = Math.floor(Math.random() * 5 + 3);
      const step = total / steps;
      for (let i = 0; i < steps; i++) {
        window.scrollBy(0, step);
        await new Promise<void>((r) => setTimeout(r, Math.random() * 200 + 50));
      }
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserManager = new BrowserManager();
