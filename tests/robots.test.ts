import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";

import { isAllowedByRobotsTxt } from "../src/utils/robots.js";

describe("isAllowedByRobotsTxt", () => {
  it("respects Disallow rules", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nDisallow: /private/\n");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const allowed = await isAllowedByRobotsTxt(`http://127.0.0.1:${port}/public`);
      assert.equal(allowed, true);
      const disallowed = await isAllowedByRobotsTxt(`http://127.0.0.1:${port}/private/secret`);
      assert.equal(disallowed, false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
