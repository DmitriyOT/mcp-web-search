# MCP Web Search Server

MCP server for web search with results optimized for LLMs and advanced bot-detection evasion.

## Features

- **Search**: DuckDuckGo (no API key), Serper.dev, Bing Web Search
- **Content extraction**: Headless browser with stealth injection
- **Anti-detection**: Fingerprint rotation, human-like behavior, proxy support
- **LLM formatting**: Clean markdown via Turndown, metadata, truncation with structure preserved
- **Robustness**: Retry with exponential backoff, concurrency limiting, in-memory caching

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

# Anti-detection
STEALTH_ENABLED=true
HEADLESS=true
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
USER_DATA_DIR=

# Limits
MAX_RESULTS=10
MAX_CONTENT_LENGTH=8000
REQUEST_TIMEOUT=30000
CACHE_TTL=300

# Behavior
MIN_DELAY=500
MAX_DELAY=3000
MAX_CONCURRENT=2

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
  "include_images": false
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
  "include_images": false
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
2. **Fingerprint rotation** — random Chrome/Edge on Windows/macOS/Linux
3. **Human-like behavior** — random delays, scroll, mouse events
4. **Proxy support** — random proxy selection from `PROXY_LIST`
5. **Fallback chain** — premium APIs first, falls back to DuckDuckGo
6. **Retry & rate limiting** — exponential backoff, bounded concurrency

## Development

```bash
npm run dev      # watch mode
npm test         # run unit tests
npm run build    # compile TypeScript
```

## License

MIT
