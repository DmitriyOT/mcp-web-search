#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
import { logger, Semaphore } from "./utils/index.js";

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
});

const SearchAndFetchSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).describe("Search query"),
  num_results: z.number().int().min(1).max(20).optional().default(5),
  fetch_content: z.boolean().optional().default(true),
  max_content_length: z.number().int().min(1).optional().default(5000),
  include_images: z.boolean().optional().default(false),
});

// Tools definition
const TOOLS: Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for a query. Returns a list of results with title, URL, and snippet. Use provider='auto' to try all available search engines.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: { type: "number", description: "Number of results (1-50)", default: 10 },
        provider: {
          type: "string",
          enum: ["auto", "duckduckgo", "serper", "bing"],
          default: "auto",
        },
        recency_days: { type: "number", description: "Limit results to recent N days" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch and extract clean text content from a URL. Optimized for LLM consumption with metadata.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        max_length: {
          type: "number",
          description: "Maximum content length in characters",
          default: 8000,
        },
        include_images: {
          type: "boolean",
          description: "Include image references",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "search_and_fetch",
    description:
      "Search the web and automatically fetch content from top results. Returns combined LLM-formatted output.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: {
          type: "number",
          description: "Number of results to fetch (1-20)",
          default: 5,
        },
        fetch_content: {
          type: "boolean",
          description: "Whether to fetch full page content",
          default: true,
        },
        max_content_length: { type: "number", description: "Max length per page", default: 5000 },
        include_images: {
          type: "boolean",
          description: "Include image references from pages",
          default: false,
        },
      },
      required: ["query"],
    },
  },
];

// Server setup
const server = new Server(
  { name: "mcp-web-search", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const message = (err as Error).message;
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on("SIGINT", async () => {
  await browserManager.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await browserManager.close();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP Web Search server running on stdio");
}

main().catch(async (err) => {
  logger.error("Fatal error", { error: String(err) });
  await browserManager.close();
  process.exit(1);
});
