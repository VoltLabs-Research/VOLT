import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
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
import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIProvider, AI_PROVIDERS } from '@modules/ai/domain/contracts/AIProviders';
import type { AIMessageToolCall, AIMessageToolResult } from '@modules/ai/domain/entities/AIMessage';
import type { AIChatFinishEvent, AIChatReplyStream, GenerateAIChatReplyInput, IAIChatTransport } from '@modules/ai/domain/port/IAIChatTransport';
import type { IAIToolService } from '@modules/ai/domain/port/IAIToolService';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import type {
    LanguageModel,
    ModelMessage,
    ToolSet
} from 'ai';
import {
    APICallError,
    convertToModelMessages,
    stepCountIs,
    streamText
} from 'ai';
import type { Response } from 'express';
import { createOllama } from 'ollama-ai-provider-v2';
import { inject } from 'tsyringe';

interface ProviderBuildOptions {
    apiKey: string;
    baseUrl?: string;
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

/**
 * Builds a configured language model for a provider. Each entry adapts that
 * provider's own option shape, forwarding an optional `baseURL` so a team can
 * point any provider at a self-hosted gateway (e.g. their own Anthropic proxy),
 * not just Ollama. `baseURL: undefined` falls back to the provider's default
 * endpoint. Building per-request (rather than via a startup
 * `createProviderRegistry`) is intentional: the API key is decrypted per team
 * on each call.
 */
type ProviderBuilder = (options: ProviderBuildOptions) => LanguageModel;

type AIStreamResult = ReturnType<typeof streamText>;

const SYSTEM_PROMPT = `You are Volt AI, an intelligent assistant for the Volt molecular simulation platform.
When users ask about their data, use available tools to query it. For destructive actions that require confirmation, the tool will request approval automatically through the streaming protocol.

To run and interpret an analysis: discover plugins with list_plugins, inspect a plugin's inputs with describe_plugin_arguments, find the target data with list_trajectories, then start it with execute_plugin (this requires user approval before it runs). Track progress with get_analysis. Once it completes, interpret results with summarize_analysis_result (per-column statistics) — use list_analysis_result_options to see what a result contains and read_analysis_result_rows when you need concrete row values. Reason over the statistics you get back; never claim a result you have not actually read.

Be concise and factual. Format responses in markdown when helpful.`;
const MAX_TOOL_STEPS = 8;

const PROVIDER_BUILDERS: Record<AIProvider, (modelId: string) => ProviderBuilder> = {
    [AIProvider.OpenAI]: (modelId) => ({ apiKey, baseUrl }) => createOpenAI({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Anthropic]: (modelId) => ({ apiKey, baseUrl }) => createAnthropic({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Google]: (modelId) => ({ apiKey, baseUrl }) => createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Groq]: (modelId) => ({ apiKey, baseUrl }) => createGroq({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.XAI]: (modelId) => ({ apiKey, baseUrl }) => createXai({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Mistral]: (modelId) => ({ apiKey, baseUrl }) => createMistral({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Cohere]: (modelId) => ({ apiKey, baseUrl }) => createCohere({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.DeepSeek]: (modelId) => ({ apiKey, baseUrl }) => createDeepSeek({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.DeepInfra]: (modelId) => ({ apiKey, baseUrl }) => createDeepInfra({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Cerebras]: (modelId) => ({ apiKey, baseUrl }) => createCerebras({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.TogetherAI]: (modelId) => ({ apiKey, baseUrl }) => createTogetherAI({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Fireworks]: (modelId) => ({ apiKey, baseUrl }) => createFireworks({ apiKey, baseURL: baseUrl })(modelId),
    [AIProvider.Ollama]: (modelId) => ({ baseUrl }) => createOllama({ baseURL: baseUrl })(modelId)
};

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

@Singleton(AI_TOKENS.AIChatTransport)
export default class AISDKChatTransport implements IAIChatTransport {
    constructor(
        @inject(AI_TOKENS.AIToolService) private readonly toolService: IAIToolService,
        private readonly integrationRepo: TeamAIIntegrationRepository,
        private readonly secretCipher: TeamAIIntegrationSecretCipher
    ) {}

    async generateReplyStream(input: GenerateAIChatReplyInput): Promise<AIChatReplyStream> {
        const modelMessages = await this.toModelMessages(input.messages);

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
                // Provider HTTP failures carry the request URL/status; without
                // them the client only ever sees the bare statusText fallback
                // (e.g. "NOT FOUND"), which is undiagnosable from the UI.
                if (APICallError.isInstance(error)) {
                    logger.error(
                        'AI provider call failed: status=%s url=%s message=%s responseBody=%s',
                        error.statusCode ?? 'unknown',
                        error.url,
                        error.message,
                        error.responseBody ?? ''
                    );
                    return;
                }

                logger.error('AI stream error: %s', error instanceof Error ? error.message : String(error));
            }
        });

        return new AISDKReplyStream(result);
    }

    /**
     * Converts persisted/transport messages to model messages. Tool-call parts
     * left in a non-terminal approval state (an interrupted approval flow) are
     * dropped via the SDK's `ignoreIncompleteToolCalls` so conversion never
     * throws — no need to fabricate synthetic tool outputs.
     */
    private async toModelMessages(messages: GenerateAIChatReplyInput['messages']): Promise<ModelMessage[]> {
        const modelInputMessages: ModelInputMessage[] = messages.map(({ id: _id, ...message }) => message);
        return convertToModelMessages(
            modelInputMessages as Parameters<typeof convertToModelMessages>[0],
            { ignoreIncompleteToolCalls: true }
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
        const builder = PROVIDER_BUILDERS[provider];
        if (!builder) {
            throw ApplicationError.badRequest(
                ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                `Provider "${provider}" is not supported. Available: ${AI_PROVIDERS.join(', ')}`
            );
        }

        let baseUrl: string | undefined;
        if (typeof metadata?.baseUrl === 'string') {
            baseUrl = metadata.baseUrl;
        }

        return builder(model)({ apiKey, baseUrl });
    }
}
