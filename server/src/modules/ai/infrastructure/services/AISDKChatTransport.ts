import {
    convertToModelMessages,
    modelMessageSchema,
    stepCountIs,
    streamText
} from 'ai';
import type {
    LanguageModel,
    ModelMessage,
    ToolSet
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createCerebras } from '@ai-sdk/cerebras';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createXai } from '@ai-sdk/xai';
import type { Response } from 'express';
import { createOllama } from 'ollama-ai-provider-v2';
import type { AIChatFinishEvent, AIChatReplyStream, GenerateAIChatReplyInput, IAIChatTransport } from '@modules/ai/domain/port/IAIChatTransport';
import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { AIProvider, AI_PROVIDERS } from '@modules/ai/domain/contracts/AIProviders';
import AIToolService from '@modules/ai/infrastructure/services/AIToolService';
import type { AIMessageToolCall, AIMessageToolResult } from '@modules/ai/domain/entities/AIMessage';
import TeamAIIntegrationSecretService from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationSecretService';
import type { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

type ProviderFactoryProvider = Exclude<AIProvider, AIProvider.Ollama>;

interface ProviderFactoryOptions {
    apiKey: string;
};

interface ProviderConfig {
    provider: AIProvider;
    model: string;
    apiKey: string;
    metadata?: Record<string, unknown>;
};

type ModelInputMessage = Omit<AIConversationMessage, 'id'>;

interface AIStreamToolCall {
    toolName: string;
    input: unknown;
};

interface AIStreamToolResult {
    toolName: string;
    input: unknown;
    output: unknown;
};

type ProviderFactory = (options: ProviderFactoryOptions) => (modelId: string) => LanguageModel;

type OllamaFactory = (options: { baseURL?: string }) => (modelId: string) => LanguageModel;

type AIStreamResult = ReturnType<typeof streamText>;

const SYSTEM_PROMPT = `You are Volt AI, an intelligent assistant for the Volt molecular simulation platform.
When users ask about their data, use available tools to query it. For destructive actions that require confirmation, the tool will request approval automatically through the streaming protocol.
Be concise and factual. Format responses in markdown when helpful.`;
const MAX_TOOL_STEPS = 8;

const PROVIDER_FACTORIES: Record<ProviderFactoryProvider, ProviderFactory> = {
    [AIProvider.OpenAI]: createOpenAI,
    [AIProvider.Anthropic]: createAnthropic,
    [AIProvider.Google]: createGoogleGenerativeAI,
    [AIProvider.Groq]: createGroq,
    [AIProvider.XAI]: createXai,
    [AIProvider.Mistral]: createMistral,
    [AIProvider.Cohere]: createCohere,
    [AIProvider.DeepSeek]: createDeepSeek,
    [AIProvider.DeepInfra]: createDeepInfra,
    [AIProvider.Cerebras]: createCerebras,
    [AIProvider.TogetherAI]: createTogetherAI,
    [AIProvider.Fireworks]: createFireworks
};

const createOllamaFactory: OllamaFactory = createOllama;

const toAIMessageToolCall = (toolCall: AIStreamToolCall): AIMessageToolCall => {
    return {
        toolName: toolCall.toolName,
        input: toolCall.input
    };
};

const toAIMessageToolResult = (toolResult: AIStreamToolResult): AIMessageToolResult => {
    return {
        toolName: toolResult.toolName,
        input: toolResult.input,
        output: toolResult.output
    };
};

class AISDKReplyStream implements AIChatReplyStream {
    constructor(private readonly result: AIStreamResult) {}

    consumeText(): Promise<string> {
        return Promise.resolve(this.result.text);
    }

    pipeToResponse(response: Response): void {
        this.result.pipeUIMessageStreamToResponse(response);
    }
};

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
                        toolCalls: step.toolCalls.map(toAIMessageToolCall),
                        toolResults: step.toolResults.map(toAIMessageToolResult)
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
        const modelInputMessages: ModelInputMessage[] = messages.map(({ id: _id, ...message }) => message);
        return convertToModelMessages(modelInputMessages as Parameters<typeof convertToModelMessages>[0]);
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
        let message = `messages: ${firstIssue.message}`;
        if (path) {
            message = `messages.${path}: ${firstIssue.message}`;
        }

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
    ): Promise<ProviderConfig> {
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
        if (provider !== AIProvider.Ollama) {
            const factory = PROVIDER_FACTORIES[provider];
            return factory({ apiKey })(model);
        }

        if (provider === AIProvider.Ollama) {
            let baseUrl: string | undefined;
            if (typeof metadata?.baseUrl === 'string') {
                baseUrl = metadata.baseUrl;
            }

            return createOllamaFactory({ baseURL: baseUrl })(model);
        }

        throw ApplicationError.badRequest(
            ErrorCodes.AI_PROVIDER_UNAVAILABLE,
            `Provider "${provider}" is not supported. Available: ${AI_PROVIDERS.join(', ')}`
        );
    }
};
