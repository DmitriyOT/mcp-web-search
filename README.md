# MCP Web Search Server

MCP server for web search with results optimized for LLMs and advanced bot-detection evasion.

## Features

- **Search**: DuckDuckGo (no API key), Serper.dev, Bing Web Search
- **Content extraction**: Headless browser with stealth injection and BrowserContext isolation
- **Anti-detection**: Dynamic fingerprint generation (viewport, UA, locale, timezone), human-like behavior, proxy support
- **LLM formatting**: Clean markdown via Turndown, metadata, structured data, links, images
- **Robustness**: Retry with exponential backoff, circuit breaker per provider, concurrency limiting, persistent cache

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

# Anti-detect
STEALTH_ENABLED=true
HEADLESS=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
USER_DATA_DIR=

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

# Optional persistent cache directory
CACHE_DIR=./cache

# Logging
LOG_LEVEL=info

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

## Anti-Detection

The server uses a layered approach:

1. **puppeteer-extra-plugin-stealth** — hides automation fingerprints
2. **Dynamic fingerprint generation** — random Chrome on Windows/macOS/Linux with matching timezone
3. **BrowserContext isolation** — separate cookies/localStorage per request
4. **Human-like behavior** — random delays, scroll, mouse events
5. **Proxy support** — random proxy selection from `PROXY_LIST`
6. **Fallback chain** — premium APIs first, falls back to DuckDuckGo
7. **Circuit breaker** — temporarily disables failing providers
8. **Retry & rate limiting** — exponential backoff, bounded concurrency

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
