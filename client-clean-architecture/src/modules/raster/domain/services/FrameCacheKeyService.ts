/**
 * Service for generating frame cache keys.
 * Pure domain logic - no external dependencies.
 */
export class FrameCacheKeyService {
    /**
     * Generates a unique cache key for a frame.
     *
     * @param timestep - Timestep number
     * @param analysisId - Analysis identifier
     * @param model - Model name
     * @returns Cache key string
     */
    generateKey(timestep: number, analysisId: string, model: string): string {
        return `${timestep}-${analysisId}-${model}`;
    }

    /**
     * Parses a cache key back to its components.
     *
     * @param key - Cache key string
     * @returns Parsed components or null if invalid
     */
    parseKey(key: string): { timestep: number; analysisId: string; model: string } | null {
        const parts = key.split('-');
        if (parts.length < 3) return null;

        const timestep = parseInt(parts[0], 10);
        if (!Number.isFinite(timestep)) return null;

        return {
            timestep,
            analysisId: parts[1],
            model: parts.slice(2).join('-') // Model name might contain hyphens
        };
    }

    /**
     * Checks if a key exists in the cache.
     */
    existsInCache(key: string, cache: Record<string, any>): boolean {
        return key in cache && cache[key] !== undefined;
    }
}
