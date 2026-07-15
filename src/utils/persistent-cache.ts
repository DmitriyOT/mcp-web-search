import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface CacheFile<T> {
  expiresAt: number;
  value: T;
}

export class PersistentCache<T> {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  async get(key: string): Promise<T | undefined> {
    const path = this.filePath(key);
    try {
      const raw = await readFile(path, "utf-8");
      const entry = JSON.parse(raw) as CacheFile<T>;
      if (Date.now() > entry.expiresAt) {
        await unlink(path);
        return undefined;
      }
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const path = this.filePath(key);
    const entry: CacheFile<T> = { expiresAt: Date.now() + ttlMs, value };
    await writeFile(path, JSON.stringify(entry), "utf-8");
  }

  private filePath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    return join(this.dir, `${hash}.json`);
  }
}
