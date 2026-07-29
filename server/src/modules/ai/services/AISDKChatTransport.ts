import {
    APICallError,
    stepCountIs,
    streamText
} from 'ai';
import type { ToolSet } from 'ai';
import type { Response } from 'express';
import type {
    AIConversationMessage,
    AIMessageToolStep
} from '@modules/ai/contracts/domain/ai-message';
import { SYSTEM_PROMPT } from '@modules/ai/contracts/domain/system-prompt';
import ModelResolver from '@modules/ai/services/ModelResolver';
import SdkMapper from '@modules/ai/services/SdkMapper';
import type AIToolServiceType from '@modules/ai/services/AIToolService';
import type { TeamAIProvider } from '@modules/team/contracts/domain/team-ai-integration';
import logger from '@shared/infrastructure/logger';

const MAX_TOOL_STEPS = 12;

let aiToolServiceCache: typeof AIToolServiceType | undefined;
const getAiToolService = (): typeof AIToolServiceType => {
    return aiToolServiceCache ??= (require('@modules/ai/services/AIToolService') as { default: typeof AIToolServiceType }).default;
};

type AIStreamResult = ReturnType<typeof streamText>;

export interface AIChatReplyStream{
    pipeToResponse(response: Response): void;
}

export interface AIChatReplyUsage{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export interface AIChatFinishEvent{
    text: string;
    totalUsage?: AIChatReplyUsage | null;
    finishReason: string;
    steps: AIMessageToolStep[];
    responseMessages: unknown[];
    provider: string;
    model: string;
}

interface GenerateAIChatReplyInput{
    teamId: string;
    userId: string;
    provider?: TeamAIProvider;
    model?: string;
    messages: AIConversationMessage[];
    onFinish?: (event: AIChatFinishEvent) => Promise<void>;
}

class AISDKReplyStream implements AIChatReplyStream{
    constructor(private readonly result: AIStreamResult){}

    pipeToResponse(response: Response): void{
        this.result.pipeUIMessageStreamToResponse(response);
    }
}

class AISDKChatTransport{
    #models = new ModelResolver();
    #mapper = new SdkMapper();

    async generateReplyStream(input: GenerateAIChatReplyInput): Promise<AIChatReplyStream>{
        const resolved = await this.#models.resolve(input.teamId, input.provider, input.model);
        const messages = await this.#mapper.toModelMessages(input.messages);
        const tools: ToolSet = getAiToolService().createToolsForContext(input.teamId, input.userId);

        const result = streamText({
            model: resolved.model,
            system: SYSTEM_PROMPT,
            messages,
            tools,
            stopWhen: stepCountIs(MAX_TOOL_STEPS),
            onFinish: async (event) => {
                if(!input.onFinish) return;

                await input.onFinish({
                    text: event.text,
                    totalUsage: event.totalUsage,
                    finishReason: event.finishReason,
                    steps: this.#mapper.toToolSteps(event.steps),
                    responseMessages: event.response.messages,
                    provider: resolved.provider,
                    model: resolved.modelName
                });
            },
            onError: ({ error }) => this.#logStreamError(error)
        });

        return new AISDKReplyStream(result);
    }

    #logStreamError(error: unknown){
        if(APICallError.isInstance(error)){
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
}

export default new AISDKChatTransport();
