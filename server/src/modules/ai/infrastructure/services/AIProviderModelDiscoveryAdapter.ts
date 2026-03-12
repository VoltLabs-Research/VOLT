import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { createHash } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { AIDiscoveredModel, IAIProviderModelDiscovery } from '@modules/ai/domain/port/IAIProviderModelDiscovery';
import type { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { Redis } from 'ioredis';

interface OpenAICompatibleModelPayload {
    id?: string;
    owned_by?: string;
};

interface TogetherAIModelPayload {
    id?: string;
    display_name?: string;
    organization?: string;
};

interface AnthropicModelPayload {
    id?: string;
    display_name?: string;
    description?: string;
};

interface GoogleModelPayload {
    name?: string;
    displayName?: string;
    description?: string;
};

interface CohereModelPayload {
    name?: string;
    endpoints?: string[];
};

interface OllamaModelPayload {
    name?: string;
    model?: string;
    details?: {
        family?: string;
        parameter_size?: string;
    };
};

interface ProviderEndpointConfig {
    buildUrl: (apiKey: string, metadata?: Record<string, unknown>) => string;
    buildHeaders: (apiKey: string) => Record<string, string>;
    extractModels: (body: unknown) => AIDiscoveredModel[];
};

const FETCH_TIMEOUT_MS = 8_000;

@injectable()
export default class AIProviderModelDiscoveryAdapter implements IAIProviderModelDiscovery {
    private readonly endpointConfigs: Partial<Record<TeamAIProvider, ProviderEndpointConfig>>;
    private readonly cacheTtlSeconds = readNumberEnv('AI_MODEL_DISCOVERY_CACHE_TTL_SECONDS', 3600);

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: Redis
    ) {
        this.endpointConfigs = this.buildEndpointConfigs();
    }

    async fetchModels(
        provider: TeamAIProvider,
        apiKey: string,
        metadata?: Record<string, unknown>
    ): Promise<AIDiscoveredModel[]> {
        const config = this.endpointConfigs[provider];
        if (!config) {
            logger.warn('No model discovery endpoint configured for provider: %s', provider);
            return [];
        }

        const cacheKey = this.buildCacheKey(provider, apiKey, metadata);
        const cached = await this.readCache(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const models = await this.fetchFromProvider(provider, apiKey, config, metadata);
        await this.writeCache(cacheKey, models);
        return models;
    }

    /**
     * Builds a cache key that never contains raw API keys.
     * For Ollama, the key is scoped by baseUrl; for all others, by a hashed API key.
     */
    private buildCacheKey(
        provider: TeamAIProvider,
        apiKey: string,
        metadata?: Record<string, unknown>
    ): string {
        const seed = provider === 'ollama'
            ? (typeof metadata?.baseUrl === 'string' ? metadata.baseUrl : 'localhost')
            : apiKey;
        const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
        return `ai:models:${provider}:${hash}`;
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

    /**
     * Fetches models from the provider API. Returns empty array on failure (never throws).
     */
    private async fetchFromProvider(
        provider: TeamAIProvider,
        apiKey: string,
        config: ProviderEndpointConfig,
        metadata?: Record<string, unknown>
    ): Promise<AIDiscoveredModel[]> {
        const url = config.buildUrl(apiKey, metadata);
        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...config.buildHeaders(apiKey)
        };

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                logger.warn(
                    'Model discovery failed for %s: HTTP %d %s',
                    provider, response.status, response.statusText
                );
                return [];
            }

            const body = await response.json();
            return config.extractModels(body);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Model discovery error for %s: %s', provider, message);
            return [];
        }
    }

    private openAICompatible(baseUrl: string): ProviderEndpointConfig {
        return {
            buildUrl: () => `${baseUrl}/models`,
            buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
            extractModels: (body) => {
                const payload = body as { data?: OpenAICompatibleModelPayload[] } | undefined;
                return (payload?.data ?? []).map((model) => ({
                    id: model.id ?? '',
                    name: model.id ?? '',
                    description: model.owned_by ? `by ${model.owned_by}` : undefined
                }));
            }
        };
    }

    private buildEndpointConfigs(): Partial<Record<TeamAIProvider, ProviderEndpointConfig>> {
        return {
            openai: this.openAICompatible('https://api.openai.com/v1'),
            groq: this.openAICompatible('https://api.groq.com/openai/v1'),
            xai: this.openAICompatible('https://api.x.ai/v1'),
            mistral: this.openAICompatible('https://api.mistral.ai/v1'),
            deepseek: {
                buildUrl: () => 'https://api.deepseek.com/models',
                buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
                extractModels: (body) => {
                    const payload = body as { data?: OpenAICompatibleModelPayload[] } | undefined;
                    return (payload?.data ?? []).map((model) => ({
                        id: model.id ?? '',
                        name: model.id ?? '',
                        description: model.owned_by ? `by ${model.owned_by}` : undefined
                    }));
                }
            },
            deepinfra: this.openAICompatible('https://api.deepinfra.com/v1/openai'),
            cerebras: this.openAICompatible('https://api.cerebras.ai/v1'),
            fireworks: this.openAICompatible('https://api.fireworks.ai/inference/v1'),
            togetherai: {
                buildUrl: () => 'https://api.together.xyz/v1/models',
                buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
                extractModels: (body) => {
                    const payload = body as { data?: TogetherAIModelPayload[] } | TogetherAIModelPayload[] | undefined;
                    const models = Array.isArray(payload) ? payload : (payload?.data ?? []);
                    return models.map((model) => ({
                        id: model.id ?? '',
                        name: model.display_name || model.id || '',
                        description: model.organization ? `by ${model.organization}` : undefined
                    }));
                }
            },
            anthropic: {
                buildUrl: () => 'https://api.anthropic.com/v1/models',
                buildHeaders: (apiKey) => ({
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }),
                extractModels: (body) => {
                    const payload = body as { data?: AnthropicModelPayload[] } | undefined;
                    return (payload?.data ?? []).map((model) => ({
                        id: model.id ?? '',
                        name: model.display_name || model.id || '',
                        description: model.description
                    }));
                }
            },
            google: {
                buildUrl: (apiKey) =>
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
                buildHeaders: () => ({}),
                extractModels: (body) => {
                    const payload = body as { models?: GoogleModelPayload[] } | undefined;
                    return (payload?.models ?? []).map((model) => ({
                        id: (model.name ?? '').replace(/^models\//, ''),
                        name: model.displayName || model.name || '',
                        description: model.description
                    }));
                }
            },
            cohere: {
                buildUrl: () => 'https://api.cohere.com/v1/models',
                buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
                extractModels: (body) => {
                    const payload = body as { models?: CohereModelPayload[] } | undefined;
                    return (payload?.models ?? []).map((model) => ({
                        id: model.name ?? '',
                        name: model.name ?? '',
                        description: model.endpoints?.length
                            ? `Endpoints: ${model.endpoints.join(', ')}`
                            : undefined
                    }));
                }
            },
            ollama: {
                buildUrl: (_apiKey, metadata) => {
                    let base = 'http://localhost:11434';
                    if (typeof metadata?.baseUrl === 'string') {
                        base = metadata.baseUrl.replace(/\/v1\/?$/, '');
                    }
                    return `${base}/api/tags`;
                },
                buildHeaders: () => ({}),
                extractModels: (body) => {
                    const payload = body as { models?: OllamaModelPayload[] } | undefined;
                    return (payload?.models ?? []).map((model) => ({
                        id: model.name ?? model.model ?? '',
                        name: model.name ?? model.model ?? '',
                        description: model.details?.parameter_size
                            ? `${model.details.family ?? ''} ${model.details.parameter_size}`.trim()
                            : undefined
                    }));
                }
            }
        };
    }
};
