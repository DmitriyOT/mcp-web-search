import type { SearchResult, SearchOptions } from "../types.js";

export abstract class SearchProvider {
  abstract name: string;
  abstract search(options: SearchOptions): Promise<SearchResult[]>;
  
  protected isAvailable(): boolean {
    return true;
  }
}
