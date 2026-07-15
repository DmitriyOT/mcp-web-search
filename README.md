# MCP Web Search Server

MCP server for web search with results optimized for LLMs and advanced bot-detection evasion.

## Features

- **Search**: DuckDuckGo (no API key), Serper.dev, Bing Web Search
- **Search aggregation**: `fallback` mode or `merge` mode that queries multiple providers in parallel, deduplicates and ranks results by query relevance
- **Content extraction**: Headless browser with stealth injection, browser page pool, and plain HTTP text fallback when pages are blocked
- **Anti-detection**: Dynamic fingerprint generation (viewport, UA, locale, timezone), human-like behavior, proxy support
- **LLM formatting**: Clean markdown via Turndown, metadata, structured data, links, images, PDF text extraction
- **OCR**: Extract text from image URLs using `tesseract.js`
- **Broken link checker**: Scan a page and report the status of its outgoing links
- **Robustness**: Retry with exponential backoff, circuit breaker per provider, token-bucket rate limiting, concurrency limiting, in-flight request deduplication, persistent cache, graceful shutdown
- **Observability**: Structured JSON logging via Pino, latency/error metrics per provider and fetch operation
- **Config hot reload**: `.env` changes are picked up automatically while the server is running
- **Multiple transports**: stdio (default) or HTTP Streamable MCP transport

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Search providers (optional — DuckDuckGo works without API keys)
SERPER_API_KEY=your_key
BING_API_KEY=your_key

# Search aggregation: "fallback" or "merge"
SEARCH_MERGE_MODE=fallback

# Rate limits (requests per second per provider)
SERPER_RATE_LIMIT=10
BING_RATE_LIMIT=10
DUCKDUCKGO_RATE_LIMIT=1

# Anti-detect
STEALTH_ENABLED=true
HEADLESS=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
USER_DATA_DIR=

# Browser page pool size
BROWSER_POOL_SIZE=2

# Limits
MAX_RESULTS=10
MAX_CONTENT_LENGTH=8000
MAX_RESPONSE_SIZE_BYTES=10000000
REQUEST_TIMEOUT=30000
CACHE_TTL=300

# Behavior
MIN_DELAY=500
MAX_DELAY=3000
MAX_CONCURRENT=2
SCROLL_TO_BOTTOM=true

# Fetch fallback when the browser is blocked
TEXT_FETCH_FALLBACK=true

# Optional persistent cache directory
CACHE_DIR=./cache

# Logging
LOG_LEVEL=info

# Transport: stdio or http
MCP_TRANSPORT=stdio
HTTP_HOST=127.0.0.1
HTTP_PORT=8080

# Ethics / safety
ROBOTS_TXT_ENABLED=true
ALLOWED_DOMAINS=
BLOCKED_DOMAINS=

# Debug only — weakens browser security
ALLOW_INSECURE_BROWSER_FLAGS=false
```

## MCP Tools

### `web_search`

Search by query.

```json
{
  "query": "latest AI developments 2025",
  "num_results": 10,
  "provider": "auto",
  "recency_days": 7
}
```

### `fetch_url`

Fetch and clean a page.

```json
{
  "url": "https://example.com/article",
  "max_length": 8000,
  "include_images": false,
  "include_links": false
}
```

### `search_and_fetch`

Search and automatically fetch top-N results.

```json
{
  "query": "quantum computing breakthrough",
  "num_results": 5,
  "fetch_content": true,
  "max_content_length": 5000,
  "include_images": false,
  "include_links": false
}
```

### `health_check`

Check provider availability, circuit breaker state, and rate limits.

```json
{}
```

### `ocr_image`

Extract text from an image URL.

```json
{
  "url": "https://example.com/screenshot.png",
  "language": "eng"
}
```

### `check_links`

Fetch a page and check its outgoing links.

```json
{
  "url": "https://example.com/article",
  "max_links": 20
}
```

## Claude Desktop Integration

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["C:\\Files\\git\\mcp-web-search\\dist\\index.js"],
      "env": {
        "SERPER_API_KEY": "..."
      }
    }
  }
}
```

## HTTP Transport

Set `MCP_TRANSPORT=http` and `HTTP_PORT=8080`, then point an MCP client that supports Streamable HTTP at `http://127.0.0.1:8080`.

## Anti-Detection & Reliability

The server uses a layered approach:

1. **puppeteer-extra-plugin-stealth** — hides automation fingerprints
2. **Dynamic fingerprint generation** — random Chrome on Windows/macOS/Linux with matching timezone
3. **Browser page pool** — reusable Puppeteer pages to reduce launch overhead
4. **Human-like behavior** — random delays, scroll, mouse events
5. **Proxy support** — random proxy selection from `PROXY_LIST`
6. **Text fetch fallback** — plain HTTP fetch when the headless browser is blocked
7. **Search result merging & ranking** — combine multiple providers and rank by relevance
8. **Circuit breaker** — temporarily disables failing providers
9. **Token-bucket rate limiting** — per-provider rate limiting
10. **Retry & concurrency limiting** — exponential backoff, bounded parallelism, in-flight deduplication
11. **Graceful shutdown** — waits for active requests on SIGINT/SIGTERM
12. **Robots.txt respect** — honors site crawl rules (can be disabled)

## Development

```bash
npm run dev          # watch mode
npm test             # run unit tests
npm run build        # compile TypeScript
npm run lint         # run ESLint
npm run format       # format with Prettier
```

## Docker

```bash
docker build -t mcp-web-search .
docker run --rm -e SERPER_API_KEY=... mcp-web-search
```

## License

MIT
