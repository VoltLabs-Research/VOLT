import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIConversationMessage, AIConversationMessagePart } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { Singleton } from '@shared/infrastructure/di/decorators';

type AITextPart = AIConversationMessagePart & { text: string };

// Domain parts are intentionally loose (`{ type: string } & Record`), so the
// SDK's `isTextUIPart` (typed against its own `UIMessagePart` union) can't be
// applied without an unsafe double-cast. A small typed guard is the honest fit
// until the domain part type is aligned with the SDK's `UIMessagePart`.
const isTextPart = (part: AIConversationMessagePart): part is AITextPart => (
    part.type === 'text' && typeof part.text === 'string'
);

@Singleton(AI_TOKENS.AIUIMessageUtils)
export default class AIUIMessageUtils {
    normalizeUIMessages(messages?: AIConversationMessage[]): AIConversationMessage[] | null {
        return messages?.length ? messages : null;
    }

    extractLastUserMessageText(messages: AIConversationMessage[]): string {
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
    }
}
