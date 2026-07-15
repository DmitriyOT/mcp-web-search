declare module "robots-parser" {
  interface Robot {
    isAllowed(url: string, ua?: string): boolean | undefined;
    isDisallowed(url: string, ua?: string): boolean | undefined;
  }

  function robotsParser(url: string, robotstxt: string): Robot;
  export = robotsParser;
}
