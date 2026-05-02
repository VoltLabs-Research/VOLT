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
import { ErrorCodes } from '@core/constants/error-codes';
import type { AIConversationMessage, AIConversationMessagePart } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIProvider, AI_PROVIDERS } from '@modules/ai/domain/contracts/AIProviders';
import type { AIMessageToolCall, AIMessageToolResult } from '@modules/ai/domain/entities/AIMessage';
import type { AIChatFinishEvent, AIChatReplyStream, GenerateAIChatReplyInput, IAIChatTransport } from '@modules/ai/domain/port/IAIChatTransport';
import AIToolService from '@modules/ai/infrastructure/services/AIToolService';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type {
    LanguageModel,
    ModelMessage,
    ToolSet
} from 'ai';
import {
    convertToModelMessages,
    modelMessageSchema,
    stepCountIs,
    streamText
} from 'ai';
import type { Response } from 'express';
import { createOllama } from 'ollama-ai-provider-v2';
import { z } from 'zod';

type ProviderFactoryProvider = Exclude<AIProvider, AIProvider.Ollama>;

interface ProviderFactoryOptions {
    apiKey: string;
}

interface ProviderConfig {
    provider: AIProvider;
    model: string;
    apiKey: string;
    metadata?: Record<string, unknown>;
}

type ModelInputMessage = Omit<AIConversationMessage, 'id'>;

interface AIStreamToolCall {
    toolName: string;
    input: unknown;
}

interface AIStreamToolResult {
    toolName: string;
    input: unknown;
    output: unknown;
}

type ProviderFactory = (options: ProviderFactoryOptions) => (modelId: string) => LanguageModel;

type OllamaFactory = (options: { baseURL?: string }) => (modelId: string) => LanguageModel;

type AIStreamResult = ReturnType<typeof streamText>;

const SYSTEM_PROMPT = `You are Volt AI, an intelligent assistant for the Volt molecular simulation platform.
When users ask about their data, use available tools to query it. For destructive actions that require confirmation, the tool will request approval automatically through the streaming protocol.
Be concise and factual. Format responses in markdown when helpful.`;
const MAX_TOOL_STEPS = 8;

const ORPHANED_TOOL_STATES = new Set(['approval-requested', 'approval-responded']);
const SYNTHETIC_TOOL_OUTPUT = 'Tool execution was handled in a previous turn.';

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
}

@Singleton()
export default class AISDKChatTransport implements IAIChatTransport {
    constructor(
        private readonly toolService: AIToolService,
        private readonly integrationRepo: TeamAIIntegrationRepository,
        private readonly secretCipher: TeamAIIntegrationSecretCipher
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
        const sanitized = this.sanitizeMessagesForModel(messages);
        const modelInputMessages: ModelInputMessage[] = sanitized.map(({ id: _id, ...message }) => message);
        return convertToModelMessages(modelInputMessages as Parameters<typeof convertToModelMessages>[0]);
    }

    /**
     * Ensures every tool-call part in assistant messages has a terminal state
     * so that the AI SDK's `convertToModelMessages` can produce a matching
     * `tool-result` for each `tool-call`.
     *
     * Parts stuck in `approval-requested` or `approval-responded` (i.e. the
     * approval flow was interrupted or the continuation hasn't executed yet)
     * are promoted to `output-available` with a synthetic output.
     *
     * Operates on shallow copies — the original messages are never mutated.
     */
    private sanitizeMessagesForModel(messages: AIConversationMessage[]): AIConversationMessage[] {
        return messages.map((message) => {
            if (message.role !== AIConversationMessageRole.Assistant) {
                return message;
            }

            let hasOrphanedParts = false;
            for (const part of message.parts) {
                if (this.isOrphanedToolPart(part)) {
                    hasOrphanedParts = true;
                    break;
                }
            }

            if (!hasOrphanedParts) {
                return message;
            }

            const sanitizedParts = message.parts.map((part) => {
                if (!this.isOrphanedToolPart(part)) {
                    return part;
                }

                const approvalId = typeof part.toolCallId === 'string'
                    ? part.toolCallId
                    : '';

                if (isRecord(part.approval) && typeof part.approval.id === 'string') {
                    return {
                        ...part,
                        state: 'output-available',
                        output: SYNTHETIC_TOOL_OUTPUT,
                        approval: { id: part.approval.id, approved: true }
                    };
                }

                return {
                    ...part,
                    state: 'output-available',
                    output: SYNTHETIC_TOOL_OUTPUT,
                    approval: { id: approvalId, approved: true }
                };
            });

            return { ...message, parts: sanitizedParts };
        });
    }

    /**
     * A tool part is considered orphaned when it carries a tool invocation
     * (type starts with `tool-`) but is still in a non-terminal approval state.
     */
    private isOrphanedToolPart(part: AIConversationMessagePart): boolean {
        return (
            typeof part.type === 'string'
            && part.type.startsWith('tool-')
            && typeof part.state === 'string'
            && ORPHANED_TOOL_STATES.has(part.state)
        );
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

            const apiKey = integration.props.encryptedApiKey
                ? await this.secretCipher.decrypt(integration.props.encryptedApiKey)
                : '';
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
        const apiKey = first.props.encryptedApiKey
            ? await this.secretCipher.decrypt(first.props.encryptedApiKey)
            : '';
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
}
