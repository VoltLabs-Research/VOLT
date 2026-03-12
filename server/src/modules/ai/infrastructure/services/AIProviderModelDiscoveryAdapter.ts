import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { injectable, inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { AIDiscoveredModel, IAIProviderModelDiscovery } from '@modules/ai/domain/port/IAIProviderModelDiscovery';
import type { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { Redis } from 'ioredis';

interface OpenRouterModel {
    id: string;
    name?: string;
    description?: string;
};

interface OllamaModelPayload {
    name?: string;
    model?: string;
    details?: {
        family?: string;
        parameter_size?: string;
    };
};

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const FETCH_TIMEOUT_MS = 10_000;
const OPENROUTER_CACHE_KEY = 'ai:models:openrouter:all';

/**
 * Maps each TeamAIProvider to the prefix(es) OpenRouter uses in model IDs.
 *
 * Inference-only providers (Groq, DeepInfra, Cerebras, Together AI, Fireworks)
 * are intentionally omitted — they host third-party models and do not publish
 * their own model IDs on OpenRouter.
 */
const PROVIDER_TO_OPENROUTER_PREFIX: Partial<Record<TeamAIProvider, string[]>> = {
    openai: ['openai'],
    anthropic: ['anthropic'],
    google: ['google'],
    xai: ['x-ai'],
    mistral: ['mistralai'],
    cohere: ['cohere'],
    deepseek: ['deepseek']
};

@injectable()
export default class AIProviderModelDiscoveryAdapter implements IAIProviderModelDiscovery {
    private readonly cacheTtlSeconds = readNumberEnv('AI_MODEL_DISCOVERY_CACHE_TTL_SECONDS', 3600);

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: Redis
    ) {}

    async fetchModels(
        provider: TeamAIProvider,
        apiKey: string,
        metadata?: Record<string, unknown>
    ): Promise<AIDiscoveredModel[]> {
        if (provider === 'ollama') {
            return this.fetchOllamaModels(metadata);
        }

        const allModels = await this.getOpenRouterModels();
        return this.filterByProvider(allModels, provider);
    }

    /**
     * Returns the full OpenRouter catalog, reading from Redis cache when available.
     * On cache miss, fetches from the public OpenRouter API and caches the result.
     */
    private async getOpenRouterModels(): Promise<AIDiscoveredModel[]> {
        const cached = await this.readCache(OPENROUTER_CACHE_KEY);
        if (cached !== null) {
            return cached;
        }

        const models = await this.fetchFromOpenRouter();
        if (models !== null) {
            await this.writeCache(OPENROUTER_CACHE_KEY, models);
        }
        return models ?? [];
    }

    /**
     * Fetches the full model catalog from OpenRouter's public API.
     * Returns `null` on HTTP or network errors (never throws).
     */
    private async fetchFromOpenRouter(): Promise<AIDiscoveredModel[] | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(OPENROUTER_MODELS_URL, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                logger.warn(
                    'OpenRouter model discovery failed: HTTP %d %s',
                    response.status,
                    response.statusText
                );
                return null;
            }

            const body = (await response.json()) as { data?: OpenRouterModel[] };
            return (body.data ?? []).map((model) => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('OpenRouter model discovery error: %s', message);
            return null;
        }
    }

    /**
     * Filters the full OpenRouter catalog to only models matching the requested provider.
     * Uses the `PROVIDER_TO_OPENROUTER_PREFIX` mapping to match model ID prefixes.
     */
    private filterByProvider(
        models: AIDiscoveredModel[],
        provider: TeamAIProvider
    ): AIDiscoveredModel[] {
        const prefixes = PROVIDER_TO_OPENROUTER_PREFIX[provider];
        if (!prefixes) {
            return [];
        }

        return models.filter((model) => {
            const idLower = model.id.toLowerCase();
            return prefixes.some((prefix) => idLower.startsWith(`${prefix}/`));
        });
    }

    /** Fetches models from a local Ollama instance via its `/api/tags` endpoint. */
    private async fetchOllamaModels(
        metadata?: Record<string, unknown>
    ): Promise<AIDiscoveredModel[]> {
        let base = 'http://localhost:11434';
        if (typeof metadata?.baseUrl === 'string') {
            base = metadata.baseUrl.replace(/\/v1\/?$/, '');
        }

        const cacheKey = `ai:models:ollama:${base}`;
        const cached = await this.readCache(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(`${base}/api/tags`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                logger.warn('Ollama model discovery failed: HTTP %d %s', response.status, response.statusText);
                return [];
            }

            const body = (await response.json()) as { models?: OllamaModelPayload[] };
            const models: AIDiscoveredModel[] = (body.models ?? []).map((m) => ({
                id: m.name ?? m.model ?? '',
                name: m.name ?? m.model ?? '',
                description: m.details?.parameter_size
                    ? `${m.details.family ?? ''} ${m.details.parameter_size}`.trim()
                    : undefined
            }));

            await this.writeCache(cacheKey, models);
            return models;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Ollama model discovery error: %s', message);
            return [];
        }
    }

    /**
     * Attempts to read models from Redis cache.
     * Returns null on miss or Redis error (non-blocking).
     */
    private async readCache(cacheKey: string): Promise<AIDiscoveredModel[] | null> {
        try {
            const raw = await this.redis.get(cacheKey);
            if (raw !== null) {
                return JSON.parse(raw) as AIDiscoveredModel[];
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Redis cache read error for key %s: %s', cacheKey, message);
        }
        return null;
    }

    /**
     * Writes discovered models to Redis cache with configured TTL.
     * Silently logs and continues on Redis error (non-blocking).
     */
    private async writeCache(cacheKey: string, models: AIDiscoveredModel[]): Promise<void> {
        try {
            await this.redis.set(cacheKey, JSON.stringify(models), 'EX', this.cacheTtlSeconds);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Redis cache write error for key %s: %s', cacheKey, message);
        }
    }
};
