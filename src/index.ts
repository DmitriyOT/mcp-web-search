#!/usr/bin/env node

import { createServer, Server as HttpServer } from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { config } from "./config.js";
import { browserManager } from "./fetcher/browser.js";
import { fetchUrl, formatForLLM } from "./fetcher/index.js";
import { SearchAggregator } from "./search/aggregator.js";
import {
  extractTextFromImage,
  isAllowedUrl,
  logger,
  Semaphore,
  shutdownManager,
  startHotReload,
  stopHotReload,
  zodSchemaToJsonSchema,
} from "./utils/index.js";

const searchAggregator = new SearchAggregator();
const fetchSemaphore = new Semaphore(config.maxConcurrent);

const MAX_QUERY_LENGTH = 500;
const MAX_URL_LENGTH = 2048;

// Schemas
const WebSearchSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).describe("Search query"),
  num_results: z.number().int().min(1).max(50).optional().default(10),
  provider: z.enum(["auto", "duckduckgo", "serper", "bing"]).optional().default("auto"),
  recency_days: z.number().int().min(1).optional(),
});

const FetchUrlSchema = z.object({
  url: z.string().url().max(MAX_URL_LENGTH).describe("URL to fetch"),
  max_length: z.number().int().min(1).optional().default(8000),
  include_images: z.boolean().optional().default(false),
  include_links: z.boolean().optional().default(false),
});

const SearchAndFetchSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).describe("Search query"),
  num_results: z.number().int().min(1).max(20).optional().default(5),
  fetch_content: z.boolean().optional().default(true),
  max_content_length: z.number().int().min(1).optional().default(5000),
  include_images: z.boolean().optional().default(false),
  include_links: z.boolean().optional().default(false),
});

const HealthCheckSchema = z.object({});

const OcrImageSchema = z.object({
  url: z.string().url().max(MAX_URL_LENGTH).describe("URL of the image to OCR"),
  language: z.string().optional().default("eng"),
});

const CheckLinksSchema = z.object({
  url: z.string().url().max(MAX_URL_LENGTH).describe("Page URL to scan for broken links"),
  max_links: z.number().int().min(1).max(100).optional().default(20),
});

// Tools definition
const TOOL_DEFINITIONS = [
  {
    name: "web_search",
    description:
      "Search the web for a query. Returns a list of results with title, URL, and snippet. Use provider='auto' to try all available search engines.",
    schema: WebSearchSchema,
  },
  {
    name: "fetch_url",
    description:
      "Fetch and extract clean text content from a URL. Optimized for LLM consumption with metadata.",
    schema: FetchUrlSchema,
  },
  {
    name: "search_and_fetch",
    description:
      "Search the web and automatically fetch content from top results. Returns combined LLM-formatted output.",
    schema: SearchAndFetchSchema,
  },
  {
    name: "health_check",
    description: "Check the health status of search providers and the server.",
    schema: HealthCheckSchema,
  },
  {
    name: "ocr_image",
    description: "Extract text from an image URL using OCR (Optical Character Recognition).",
    schema: OcrImageSchema,
  },
  {
    name: "check_links",
    description:
      "Fetch a page and check its outgoing links for broken URLs. Returns status for each checked link.",
    schema: CheckLinksSchema,
  },
];

const TOOLS: Tool[] = TOOL_DEFINITIONS.map(({ name, description, schema }) => ({
  name,
  description,
  inputSchema: zodSchemaToJsonSchema(schema),
}));

// Server setup
const server = new Server(
  { name: "mcp-web-search", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) =>
  logger.runWithRequestId(async () => {
    const endRequest = shutdownManager.beginRequest();
    try {
      const { name, arguments: args } = request.params;

      try {
        if (name === "web_search") {
          const parsed = WebSearchSchema.parse(args);
          const results = await searchAggregator.search({
            query: parsed.query,
            numResults: parsed.num_results,
            provider: parsed.provider,
            recencyDays: parsed.recency_days,
          });

          const output = results
            .map(
              (r, i) =>
                `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}${r.date ? `\n   Date: ${r.date}` : ""}`
            )
            .join("\n\n");

          return {
            content: [{ type: "text", text: output || "No results found." }],
          };
        }

        if (name === "fetch_url") {
          const parsed = FetchUrlSchema.parse(args);
          const result = await fetchUrl({
            url: parsed.url,
            maxLength: parsed.max_length,
            includeImages: parsed.include_images,
            includeLinks: parsed.include_links,
          });

          let text = `Title: ${result.title}\nURL: ${result.url}\n`;
          if (result.metadata.date) text += `Date: ${result.metadata.date}\n`;
          if (result.metadata.author) text += `Author: ${result.metadata.author}\n`;
          if (result.metadata.description) text += `Description: ${result.metadata.description}\n`;
          text += `\n${result.content}`;

          return {
            content: [{ type: "text", text }],
          };
        }

        if (name === "health_check") {
          HealthCheckSchema.parse(args);
          const health = searchAggregator.health();
          const lines = health.map(
            (h) => `${h.name}: available=${h.available}, circuit=${h.circuitState}`
          );
          return {
            content: [{ type: "text", text: lines.join("\n") }],
          };
        }

        if (name === "search_and_fetch") {
          const parsed = SearchAndFetchSchema.parse(args);
          const searchResults = await searchAggregator.search({
            query: parsed.query,
            numResults: parsed.num_results,
          });

          if (!parsed.fetch_content) {
            const output = searchResults
              .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
              .join("\n\n");
            return {
              content: [{ type: "text", text: output || "No results found." }],
            };
          }

          const fetched: Awaited<ReturnType<typeof fetchUrl>>[] = [];
          const fetchPromises = searchResults.slice(0, parsed.num_results).map((r) =>
            fetchSemaphore.run(async () => {
              try {
                return await fetchUrl({
                  url: r.url,
                  maxLength: parsed.max_content_length,
                  includeImages: parsed.include_images,
                  includeLinks: parsed.include_links,
                });
              } catch (err) {
                return {
                  url: r.url,
                  title: r.title,
                  content: `[Failed to fetch: ${(err as Error).message}]`,
                  metadata: {},
                };
              }
            })
          );
          fetched.push(...(await Promise.all(fetchPromises)));

          return {
            content: [{ type: "text", text: formatForLLM(fetched) }],
          };
        }

        if (name === "ocr_image") {
          const parsed = OcrImageSchema.parse(args);
          if (!isAllowedUrl(parsed.url)) {
            throw new Error(`URL not allowed: ${parsed.url}`);
          }

          const response = await fetch(parsed.url, {
            redirect: "follow",
            signal: AbortSignal.timeout(config.requestTimeout),
          });
          if (!response.ok) {
            throw new Error(`Image fetch failed: ${response.status}`);
          }

          const contentType = response.headers.get("content-type") || "";
          if (!contentType.startsWith("image/")) {
            throw new Error(`URL is not an image: ${contentType}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > config.maxResponseSizeBytes) {
            throw new Error(
              `Image too large: ${buffer.length} bytes (max ${config.maxResponseSizeBytes})`
            );
          }

          const text = await extractTextFromImage(buffer, parsed.language);
          return {
            content: [{ type: "text", text: text || "No text found in image." }],
          };
        }

        if (name === "check_links") {
          const parsed = CheckLinksSchema.parse(args);
          const fetched = await fetchUrl({
            url: parsed.url,
            includeLinks: true,
            maxLength: 1000,
          });

          const links = (fetched.metadata.links ?? [])
            .map((link) => link.url)
            .filter((url, index, arr) => arr.indexOf(url) === index)
            .slice(0, parsed.max_links);

          const results = await Promise.all(
            links.map(async (url) => {
              try {
                const response = await fetch(url, {
                  method: "HEAD",
                  redirect: "follow",
                  signal: AbortSignal.timeout(config.requestTimeout),
                });
                return { url, status: response.status, ok: response.ok };
              } catch (err) {
                return { url, status: 0, ok: false, error: (err as Error).message };
              }
            })
          );

          const lines = results.map((r) => {
            const status = r.status === 0 ? "ERROR" : String(r.status);
            const marker = r.ok ? "✓" : "✗";
            return `${marker} ${r.url} (${status})${r.error ? ` - ${r.error}` : ""}`;
          });

          return {
            content: [
              {
                type: "text",
                text: lines.join("\n") || "No links found on the page.",
              },
            ],
          };
        }

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        const message = (err as Error).message;
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    } finally {
      endRequest();
    }
  })
);

// Cleanup on exit
process.on("SIGINT", async () => {
  stopHotReload();
  await shutdownManager.shutdown();
  await browserManager.close();
  await httpServer?.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  stopHotReload();
  await shutdownManager.shutdown();
  await browserManager.close();
  await httpServer?.close();
  process.exit(0);
});

let httpServer: HttpServer | undefined;

// Start server
async function main() {
  startHotReload();

  if (config.mcpTransport === "http") {
    if (!config.httpPort) {
      throw new Error("HTTP transport selected but HTTP_PORT is not set");
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);

    httpServer = createServer((req, res) => {
      transport.handleRequest(req, res).catch((err: Error) => {
        logger.error("HTTP transport error", { error: err.message });
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });
    });

    await new Promise<void>((resolve) => {
      httpServer!.listen(config.httpPort, config.httpHost, () => {
        logger.info("MCP Web Search server running on HTTP", {
          host: config.httpHost,
          port: config.httpPort,
        });
        resolve();
      });
    });
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP Web Search server running on stdio");
}

main().catch(async (err) => {
  logger.error("Fatal error", { error: String(err) });
  await browserManager.close();
  await httpServer?.close();
  process.exit(1);
});
