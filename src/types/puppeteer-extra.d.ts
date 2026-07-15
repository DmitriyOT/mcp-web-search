declare module "puppeteer-extra-plugin-user-preferences" {
  import type { PuppeteerExtraPlugin } from "puppeteer-extra-plugin";
  interface UserPreferencesOptions {
    userPrefs?: Record<string, unknown>;
  }
  function plugin(options?: UserPreferencesOptions): PuppeteerExtraPlugin;
  export default plugin;
}

declare module "puppeteer-extra-plugin-user-data-dir" {
  import type { PuppeteerExtraPlugin } from "puppeteer-extra-plugin";
  interface UserDataDirOptions {
    userDataDir?: string;
  }
  function plugin(options?: UserDataDirOptions): PuppeteerExtraPlugin;
  export default plugin;
}
