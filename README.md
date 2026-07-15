# MCP Web Search Server

MCP сервер для веб-поиска с результатами, оптимизированными для LLM, и продвинутыми механизмами обхода бот-детекции.

## Возможности

- **Поиск**: DuckDuckGo (без API ключа), Serper.dev, Bing Web Search
- **Извлечение контента**: Headless-браузер с stealth-инжекцией
- **Анти-детекция**: Ротация fingerprints, human-like behavior, прокси
- **LLM-форматирование**: Чистый markdown, метаданные, обрезка с сохранением структуры

## Установка

```bash
npm install
npm run build
npx playwright install chromium
```

## Конфигурация

Скопируйте `.env.example` в `.env` и настройте:

```env
# Поисковые провайдеры (опционально)
SERPER_API_KEY=your_key
BING_API_KEY=your_key

# Анти-детекция
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
STEALTH_ENABLED=true
HEADLESS=true
```

## MCP Tools

### `web_search`
Поиск по запросу.

```json
{
  "query": "latest AI developments 2025",
  "num_results": 10,
  "provider": "auto"
}
```

### `fetch_url`
Загрузка и очистка страницы.

```json
{
  "url": "https://example.com/article",
  "max_length": 8000
}
```

### `search_and_fetch`
Поиск + автоматическая загрузка топ-N результатов.

```json
{
  "query": "quantum computing breakthrough",
  "num_results": 5,
  "fetch_content": true
}
```

## Интеграция с Claude Desktop

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["C:\\gitlab\\mcp-web-search\\dist\\index.js"],
      "env": {
        "SERPER_API_KEY": "..."
      }
    }
  }
}
```

## Анти-детекция

Сервер использует многоуровневый подход:

1. **puppeteer-extra-plugin-stealth** — скрывает признаки автоматизации
2. **Fingerprint ротация** — случайный выбор Chrome/Edge на Windows/macOS/Linux
3. **Human-like behavior** — случайные задержки, скролл, mouse events
4. **Прокси-ротация** — поддержка HTTP/SOCKS5
5. **Fallback-цепочка** — при блокировке переключается между методами
6. **Rate limiting** — ограничение concurrency, exponential backoff
