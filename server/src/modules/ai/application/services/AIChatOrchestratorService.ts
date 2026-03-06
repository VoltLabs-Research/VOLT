import { inject, injectable } from 'tsyringe';
import { streamText, stepCountIs, modelMessageSchema, type ToolSet, type LanguageModel, type StreamTextResult, type ModelMessage, type StepResult, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createMistral } from '@ai-sdk/mistral';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createCerebras } from '@ai-sdk/cerebras';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createFireworks } from '@ai-sdk/fireworks';
import { createOllama } from 'ollama-ai-provider-v2';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import AIToolService from '@modules/ai/application/services/AIToolService';
import { AI_PROVIDERS, type AIProvider } from '@modules/ai/domain/constants/AIProviders';
import type { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ITeamAIIntegrationRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';

const SYSTEM_PROMPT = `You are Volt AI, an intelligent assistant for the Volt molecular simulation platform.
When users ask about their data, use available tools to query it. For destructive actions that require confirmation, the tool will request approval automatically through the streaming protocol.
Be concise and factual. Format responses in markdown when helpful.`;
const MAX_TOOL_STEPS = 8;

interface GenerateReplyInput {
    teamId: string;
    userId: string;
    provider?: string;
    model?: string;
    messages: ModelMessage[];
    onFinish?: (event: {
        text: string;
        totalUsage: LanguageModelUsage;
        finishReason: string;
        steps: StepResult<any>[];
        responseMessages: any[];
        provider: string;
        model: string;
    }) => Promise<void>;
}

type ProviderFactoryProvider = Exclude<AIProvider, 'ollama'>;

/** Maps provider names to @ai-sdk factory functions. */
const PROVIDER_FACTORIES: Record<ProviderFactoryProvider, (opts: { apiKey: string }) => any> = {
    openai: createOpenAI,
    anthropic: createAnthropic,
    google: createGoogleGenerativeAI,
    groq: createGroq,
    xai: createXai,
    mistral: createMistral,
    cohere: createCohere,
    deepseek: createDeepSeek,
    deepinfra: createDeepInfra,
    cerebras: createCerebras,
    togetherai: createTogetherAI,
    fireworks: createFireworks,
};


@injectable()
export default class AIChatOrchestratorService {
    constructor(
        @inject(AI_TOKENS.AIToolService)
        private readonly toolService: AIToolService,

        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepo: ITeamAIIntegrationRepository
    ) {}

    async generateReplyStream(input: GenerateReplyInput): Promise<StreamTextResult<any, any>> {
        const { provider: providerName, model: modelName, apiKey, metadata } =
            await this.resolveProviderConfig(input.teamId, input.provider, input.model);

        const languageModel = this.buildModel(providerName, modelName, apiKey, metadata);
        const tools: ToolSet = this.toolService.createToolsForContext(input.teamId, input.userId);

        // Pre-validate messages to get actionable error details instead of
        // a generic "messages do not match ModelMessage[] schema" error.
        const schema = z.array(modelMessageSchema);
        const validation = schema.safeParse(input.messages);
        if (!validation.success) {
            const issues = validation.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
                received: (issue as any).received
            }));
            logger.error('ModelMessage validation failed. Issues: %j', issues);
            logger.debug('Rejected messages payload: %j', input.messages);
        }

        const result = streamText({
            model: languageModel,
            system: SYSTEM_PROMPT,
            messages: input.messages,
            tools,
            // Keep streamText for now to preserve BYOK provider switching and existing UI stream contract.
            stopWhen: stepCountIs(MAX_TOOL_STEPS),
            onFinish: async (event) => {
                if (input.onFinish) {
                    await input.onFinish({
                        text: event.text,
                        totalUsage: event.totalUsage,
                        finishReason: event.finishReason,
                        steps: event.steps,
                        responseMessages: event.response.messages,
                        provider: providerName,
                        model: modelName
                    });
                }
            },
            onError: ({ error }) => {
                logger.error('AI stream error: %s', error instanceof Error ? error.message : String(error));
            }
        });

        return result;
    }

    // ─── Provider Resolution ───

    private async resolveProviderConfig(
        teamId: string,
        requestedProvider?: string,
        requestedModel?: string
    ): Promise<{ provider: AIProvider; model: string; apiKey: string; metadata?: Record<string, unknown> }> {
        const integrations = await this.integrationRepo.listEnabledByTeamIdWithSecrets(teamId);

        if (!integrations.length) {
            throw ApplicationError.badRequest(
                ErrorCodes.AI_INTEGRATION_NOT_CONFIGURED,
                'No AI provider integrations configured for this team'
            );
        }

        const findIntegration = (name: string) =>
            integrations.find((i) => i.props.provider === name);

        if (requestedProvider) {
            const integration = findIntegration(requestedProvider);
            if (!integration) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                    `Provider "${requestedProvider}" is not configured for this team`
                );
            }
            const apiKey = integration.getApiKey();
            const model = requestedModel || integration.props.defaultModel;
            if (!model) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                    `No model specified and provider "${requestedProvider}" has no default model configured`
                );
            }
            return { provider: integration.props.provider, model, apiKey, metadata: integration.props.metadata };
        }

        // Use first available integration
        const first = integrations[0];
        const provider = first.props.provider;
        const apiKey = first.getApiKey();
        const model = requestedModel || first.props.defaultModel;
        if (!model) {
            throw ApplicationError.badRequest(
                ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                `No model specified and provider "${provider}" has no default model configured`
            );
        }
        return { provider, model, apiKey, metadata: first.props.metadata };
    }

    private buildModel(provider: AIProvider, model: string, apiKey: string, metadata?: Record<string, unknown>): LanguageModel {
        const factory = provider === 'ollama' ? null : PROVIDER_FACTORIES[provider];
        if (factory) {
            return (factory({ apiKey }) as any)(model);
        }

        // Ollama provider uses baseUrl from integration metadata
        if (provider === 'ollama') {
            const baseUrl = typeof metadata?.baseUrl === 'string' ? metadata.baseUrl : undefined;
            return createOllama({ baseURL: baseUrl } as any)(model);
        }

        throw ApplicationError.badRequest(
            ErrorCodes.AI_PROVIDER_UNAVAILABLE,
            `Provider "${provider}" is not supported. Available: ${AI_PROVIDERS.join(', ')}`
        );
    }
}
