import { injectable } from 'tsyringe';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type { AIConversationMessage } from '@modules/ai/application/contracts/AIConversationMessage';

@injectable()
export default class AIUIMessageUtils {
    private isSupportedRole(role: unknown): role is 'user' | 'assistant' | 'system' {
        return role === 'user' || role === 'assistant' || role === 'system';
    }

    private isValidUIMessage(message: unknown): message is AIConversationMessage {
        if (!isRecord(message)) {
            return false;
        }

        return (
            typeof message.id === 'string'
            && this.isSupportedRole(message.role)
            && Array.isArray(message.parts)
        );
    }

    private isTextPart(part: unknown): part is { type: 'text'; text: string } {
        if (!isRecord(part)) {
            return false;
        }

        return part.type === 'text' && typeof part.text === 'string';
    }

    normalizeUIMessages(messages: unknown): AIConversationMessage[] | null {
        if (!Array.isArray(messages) || messages.length === 0) {
            return null;
        }

        const normalized = messages.filter((message): message is AIConversationMessage => this.isValidUIMessage(message));

        return normalized.length > 0 ? normalized : null;
    }

    extractLastUserMessageText(messages: AIConversationMessage[]): string {
        for (let index = messages.length - 1; index >= 0; index--) {
            const message = messages[index];
            if (message.role !== 'user') {
                continue;
            }

            return message.parts
                .filter((part): part is { type: 'text'; text: string } => this.isTextPart(part))
                .map((part) => part.text)
                .join('\n')
                .trim();
        }

        return '';
    }
}
