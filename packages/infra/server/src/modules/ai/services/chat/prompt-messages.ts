import { convertToModelMessages } from 'ai';
import type { ModelMessage, ToolSet } from 'ai';
import type { ChatUIMessage } from '@volt/contracts/modules/ai/chat';

// Reasoning stays out of the prompt: providers sign their own, and a conversation can change provider.
const withoutReasoning = (message: ChatUIMessage): ChatUIMessage => ({
    ...message,
    parts: message.parts.filter((part) => part.type !== 'reasoning')
});

export const toModelMessages = (history: ChatUIMessage[], tools: ToolSet): Promise<ModelMessage[]> =>
    convertToModelMessages(history.map(withoutReasoning), {
        tools,
        ignoreIncompleteToolCalls: true
    });
