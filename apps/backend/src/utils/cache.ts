import crypto from 'crypto';

interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class LLMCache {
  private cache = new Map<string, CachedResponse>();
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

  private isExpired(cached: CachedResponse): boolean {
    return Date.now() > cached.timestamp + cached.ttl;
  }

  private generateKey(input: string, context?: string): string {
    const combined = context ? `${input}:${context}` : input;
    return crypto.createHash('sha256').update(combined.toLowerCase().trim()).digest('hex');
  }

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up expired entries periodically (every 100 sets)
    if (this.cache.size % 100 === 0) {
      this.cleanup();
    }
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (this.isExpired(cached)) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  getCacheKey(type: 'classification' | 'sql' | 'analysis' | 'summary', input: string, context?: string): string {
    return this.generateKey(`${type}:${input}`, context);
  }

  private cleanup(): void {
    for (const [key, cached] of this.cache.entries()) {
      if (this.isExpired(cached)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const llmCache = new LLMCache(); 