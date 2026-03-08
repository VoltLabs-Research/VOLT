import { injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import type { AIDiscoveredModel, IAIProviderModelDiscovery } from '@modules/ai/application/ports/IAIProviderModelDiscovery';

interface ProviderEndpointConfig {
    buildUrl: (apiKey: string, metadata?: Record<string, unknown>) => string;
    buildHeaders: (apiKey: string) => Record<string, string>;
    extractModels: (body: any) => AIDiscoveredModel[];
}

const FETCH_TIMEOUT_MS = 8_000;

@injectable()
export default class AIProviderModelDiscoveryAdapter implements IAIProviderModelDiscovery {
    private readonly endpointConfigs: Partial<Record<TeamAIProvider, ProviderEndpointConfig>>;

    constructor() {
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
            extractModels: (body) =>
                (body?.data ?? []).map((model: any) => ({
                    id: model.id,
                    name: model.id,
                    description: model.owned_by ? `by ${model.owned_by}` : undefined
                }))
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
                extractModels: (body) =>
                    (body?.data ?? []).map((model: any) => ({
                        id: model.id,
                        name: model.id,
                        description: model.owned_by ? `by ${model.owned_by}` : undefined
                    }))
            },
            deepinfra: this.openAICompatible('https://api.deepinfra.com/v1/openai'),
            cerebras: this.openAICompatible('https://api.cerebras.ai/v1'),
            fireworks: this.openAICompatible('https://api.fireworks.ai/inference/v1'),
            togetherai: {
                buildUrl: () => 'https://api.together.xyz/v1/models',
                buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
                extractModels: (body) => {
                    const models = Array.isArray(body) ? body : (body?.data ?? []);
                    return models.map((model: any) => ({
                        id: model.id,
                        name: model.display_name || model.id,
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
                extractModels: (body) =>
                    (body?.data ?? []).map((model: any) => ({
                        id: model.id,
                        name: model.display_name || model.id,
                        description: model.description
                    }))
            },
            google: {
                buildUrl: (apiKey) =>
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
                buildHeaders: () => ({}),
                extractModels: (body) =>
                    (body?.models ?? []).map((model: any) => ({
                        id: (model.name ?? '').replace(/^models\//, ''),
                        name: model.displayName || model.name,
                        description: model.description
                    }))
            },
            cohere: {
                buildUrl: () => 'https://api.cohere.com/v1/models',
                buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
                extractModels: (body) =>
                    (body?.models ?? []).map((model: any) => ({
                        id: model.name,
                        name: model.name,
                        description: model.endpoints?.length
                            ? `Endpoints: ${model.endpoints.join(', ')}`
                            : undefined
                    }))
            },
            ollama: {
                buildUrl: (_apiKey, metadata) => {
                    const base = typeof metadata?.baseUrl === 'string'
                        ? metadata.baseUrl.replace(/\/v1\/?$/, '')
                        : 'http://localhost:11434';
                    return `${base}/api/tags`;
                },
                buildHeaders: () => ({}),
                extractModels: (body) =>
                    (body?.models ?? []).map((model: any) => ({
                        id: model.name ?? model.model,
                        name: model.name ?? model.model,
                        description: model.details?.parameter_size
                            ? `${model.details.family ?? ''} ${model.details.parameter_size}`.trim()
                            : undefined
                    }))
            }
        };
    }
}
