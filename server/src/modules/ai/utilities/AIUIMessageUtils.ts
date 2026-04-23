import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { Singleton } from '@shared/infrastructure/di/decorators';


type AITextPart = {
    type: 'text';
    text: string;
} & Record<string, unknown>;

@Singleton()
export default class AIUIMessageUtils {
    private isTextPart(part: unknown): part is AITextPart {
        return typeof part === 'object'
            && part !== null
            && 'type' in part
            && 'text' in part
            && part.type === 'text'
            && typeof part.text === 'string';
    }

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
                .filter((part): part is AITextPart => this.isTextPart(part))
                .map((part) => part.text)
                .join('\n')
                .trim();
        }

        return '';
    }
};
