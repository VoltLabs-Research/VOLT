import type { AIConversationMessage, AIConversationMessagePart } from '@modules/ai/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/contracts/AIConversationMessage';

type AITextPart = AIConversationMessagePart & { text: string };

const isTextPart = (part: AIConversationMessagePart): part is AITextPart => (
    part.type === 'text' && typeof part.text === 'string'
);

export const normalizeUIMessages = (messages?: AIConversationMessage[]): AIConversationMessage[] | null => {
    return messages?.length ? messages : null;
};

export const extractLastUserMessageText = (messages: AIConversationMessage[]): string => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.role !== AIConversationMessageRole.User) {
            continue;
        }

        return message.parts
            .filter(isTextPart)
            .map((part) => part.text)
            .join('\n')
            .trim();
    }

    return '';
};
