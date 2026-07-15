export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  metadata: {
    date?: string;
    author?: string;
    description?: string;
    keywords?: string;
    structuredData?: unknown[];
    links?: { text: string; url: string }[];
  };
}

export interface SearchOptions {
  query: string;
  numResults?: number;
  provider?: "auto" | "duckduckgo" | "serper" | "bing";
  recencyDays?: number;
}

export interface FetchOptions {
  url: string;
  maxLength?: number;
  includeImages?: boolean;
  includeLinks?: boolean;
}
