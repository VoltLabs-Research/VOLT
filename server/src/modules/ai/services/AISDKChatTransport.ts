import {
    APICallError,
    stepCountIs,
    streamText
} from 'ai';
import type { ToolSet } from 'ai';
import type {
    AIConversationMessage,
    AIMessageTokenUsage,
    AIMessageToolStep
} from '@modules/ai/contracts/ai-message';
import { SYSTEM_PROMPT } from '@modules/ai/contracts/system-prompt';
import AIToolService from '@modules/ai/services/AIToolService';
import ModelResolver from '@modules/ai/services/ModelResolver';
import { toModelMessages, toToolSteps } from '@modules/ai/services/SdkMapper';
import type { AIProvider } from '@shared/contracts/types/AIProviders';
import logger from '@shared/infrastructure/logger';

const MAX_TOOL_STEPS = 12;

export type AIChatReplyStream = ReturnType<typeof streamText>;

export interface AIChatFinishEvent{
    text: string;
    totalUsage?: Partial<AIMessageTokenUsage> | null;
    finishReason: string;
    steps: AIMessageToolStep[];
    responseMessages: unknown[];
    provider: string;
    model: string;
}

interface GenerateAIChatReplyInput{
    teamId: string;
    userId: string;
    provider?: AIProvider;
    model?: string;
    messages: AIConversationMessage[];
    onFinish?: (event: AIChatFinishEvent) => Promise<void>;
}

class AISDKChatTransport{
    #models = new ModelResolver();

    async generateReplyStream(input: GenerateAIChatReplyInput): Promise<AIChatReplyStream>{
        const resolved = await this.#models.resolve(input.teamId, input.provider, input.model);
        const messages = await toModelMessages(input.messages);
        const tools: ToolSet = AIToolService.createToolsForContext(input.teamId, input.userId);

        return streamText({
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
                    steps: toToolSteps(event.steps),
                    responseMessages: event.response.messages,
                    provider: resolved.provider,
                    model: resolved.modelName
                });
            },
            onError: ({ error }) => this.#logStreamError(error)
        });
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
