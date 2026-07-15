declare module "puppeteer-extra-plugin-user-preferences" {
  interface UserPreferencesOptions {
    userPrefs?: Record<string, unknown>;
  }
  function plugin(options?: UserPreferencesOptions): import("puppeteer-extra").PuppeteerExtraPlugin;
  export default plugin;
}

declare module "puppeteer-extra-plugin-user-data-dir" {
  interface UserDataDirOptions {
    userDataDir?: string;
  }
  function plugin(options?: UserDataDirOptions): import("puppeteer-extra").PuppeteerExtraPlugin;
  export default plugin;
}
