import AIMessage from '@modules/ai/models/AIMessage';
import type { AIChatFinishEvent } from '@modules/ai/services/AISDKChatTransport';
import { mapAssistantResponseParts, mergeAssistantParts } from '@modules/ai/services/AIResponseMessagePartsMapper';
import { toAIMessageView } from '@modules/ai/services/AIMessageViewMapper';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';

/* Persists the assistant reply produced by a finished chat stream, folding it into
   the message already on record when the stream was a continuation. */

export const persistAssistantResponse = async (
    conversationId: string,
    event: AIChatFinishEvent,
    existingMessage: AIMessage | null
): Promise<Record<string, unknown> | undefined> => {
    const { parts, textContent } = mapAssistantResponseParts(event.responseMessages);

    if(parts.length === 0){
        return existingMessage ? toAIMessageView(existingMessage) : undefined;
    }

    const usage = event.totalUsage;

    if(existingMessage){
        const carried = existingMessage.tokenUsage;

        return toAIMessageView(await Object.assign(existingMessage, {
            parts: mergeAssistantParts(existingMessage.parts, parts),
            content: [existingMessage.content, textContent].filter(Boolean).join('\n'),
            modelInfo: {
                provider: event.provider,
                model: event.model,
                finishReason: event.finishReason,
                steps: [
                    ...(existingMessage.modelInfo?.steps ?? []),
                    ...event.steps
                ]
            },
            tokenUsage: {
                inputTokens: (carried?.inputTokens ?? 0) + (usage?.inputTokens ?? 0),
                outputTokens: (carried?.outputTokens ?? 0) + (usage?.outputTokens ?? 0),
                totalTokens: (carried?.totalTokens ?? 0) + (usage?.totalTokens ?? 0)
            }
        }).save());
    }

    return toAIMessageView(await AIMessage.create({
        conversationId,
        role: AIMessageRole.Assistant,
        parts,
        content: textContent,
        modelInfo: {
            provider: event.provider,
            model: event.model,
            finishReason: event.finishReason,
            steps: event.steps
        },
        tokenUsage: {
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0
        }
    }).save());
};
