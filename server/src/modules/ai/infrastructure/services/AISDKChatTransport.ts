import { inject, injectable } from 'tsyringe';
import {
    streamText,
    stepCountIs,
    modelMessageSchema,
    convertToModelMessages,
    type ToolSet,
    type LanguageModel,
    type ModelMessage
} from 'ai';
import type { Response } from 'express';
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
import TeamAIIntegrationSecretService from '@modules/team/application/services/TeamAIIntegrationSecretService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';
import type {
    AIChatFinishEvent,
    AIChatReplyStream,
    GenerateAIChatReplyInput,
    IAIChatTransport
} from '@modules/ai/application/ports/IAIChatTransport';

const SYSTEM_PROMPT = `You are Volt AI, an intelligent assistant for the Volt molecular simulation platform.
When users ask about their data, use available tools to query it. For destructive actions that require confirmation, the tool will request approval automatically through the streaming protocol.
Be concise and factual. Format responses in markdown when helpful.`;
const MAX_TOOL_STEPS = 8;

type ProviderFactoryProvider = Exclude<AIProvider, 'ollama'>;

const PROVIDER_FACTORIES: Record<ProviderFactoryProvider, (opts: { apiKey: string }) => unknown> = {
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
    fireworks: createFireworks
};

class AISDKReplyStream implements AIChatReplyStream {
    constructor(private readonly result: ReturnType<typeof streamText>) {}

    consumeText(): Promise<string> {
        return Promise.resolve(this.result.text);
    }

    pipeToResponse(response: unknown): void {
        this.result.pipeUIMessageStreamToResponse(response as Response);
    }
}

@injectable()
export default class AISDKChatTransport implements IAIChatTransport {
    constructor(
        @inject(AI_TOKENS.AIToolService)
        private readonly toolService: AIToolService,

        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly integrationRepo: ITeamAIIntegrationRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationSecretService)
        private readonly secretService: TeamAIIntegrationSecretService
    ) {}

    async generateReplyStream(input: GenerateAIChatReplyInput): Promise<AIChatReplyStream> {
        const modelMessages = await this.toModelMessages(input.messages);
        this.validateMessages(modelMessages);

        const { provider: providerName, model: modelName, apiKey, metadata } =
            await this.resolveProviderConfig(input.teamId, input.provider, input.model);

        const languageModel = this.buildModel(providerName, modelName, apiKey, metadata);
        const tools: ToolSet = this.toolService.createToolsForContext(input.teamId, input.userId);

        const result = streamText({
            model: languageModel,
            system: SYSTEM_PROMPT,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(MAX_TOOL_STEPS),
            onFinish: async (event) => {
                if (!input.onFinish) {
                    return;
                }

                const finishEvent: AIChatFinishEvent = {
                    text: event.text,
                    totalUsage: event.totalUsage,
                    finishReason: event.finishReason,
                    steps: event.steps.map((step) => ({
                        stepNumber: step.stepNumber,
                        toolCalls: step.toolCalls.map((toolCall: any) => ({
                            toolName: toolCall.toolName,
                            input: toolCall.args
                        })),
                        toolResults: step.toolResults.map((toolResult: any) => ({
                            toolName: toolResult.toolName,
                            input: toolResult.args,
                            output: toolResult.result
                        }))
                    })),
                    responseMessages: event.response.messages,
                    provider: providerName,
                    model: modelName
                };

                await input.onFinish(finishEvent);
            },
            onError: ({ error }) => {
                logger.error('AI stream error: %s', error instanceof Error ? error.message : String(error));
            }
        });

        return new AISDKReplyStream(result);
    }

    private async toModelMessages(messages: GenerateAIChatReplyInput['messages']): Promise<ModelMessage[]> {
        return convertToModelMessages(messages as any);
    }

    private validateMessages(messages: ModelMessage[]): void {
        const validation = z.array(modelMessageSchema).safeParse(messages);

        if (validation.success) {
            return;
        }

        const issues = validation.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
        }));
        const firstIssue = validation.error.issues[0];
        const path = firstIssue.path.map((segment) => String(segment)).join('.');
        const message = path
            ? `messages.${path}: ${firstIssue.message}`
            : `messages: ${firstIssue.message}`;

        logger.error('ModelMessage validation failed. Issues: %j', issues);
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            message
        );
    }

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
            integrations.find((integration) => integration.props.provider === name);

        if (requestedProvider) {
            const integration = findIntegration(requestedProvider);
            if (!integration) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                    `Provider "${requestedProvider}" is not configured for this team`
                );
            }

            const apiKey = this.secretService.decryptApiKey(integration.props.encryptedApiKey);
            const model = requestedModel || integration.props.defaultModel;
            if (!model) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                    `No model specified and provider "${requestedProvider}" has no default model configured`
                );
            }

            return { provider: integration.props.provider, model, apiKey, metadata: integration.props.metadata };
        }

        const first = integrations[0];
        const provider = first.props.provider;
        const apiKey = this.secretService.decryptApiKey(first.props.encryptedApiKey);
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
