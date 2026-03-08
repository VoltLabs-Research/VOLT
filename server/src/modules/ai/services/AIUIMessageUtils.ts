import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { injectable } from 'tsyringe';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

type AITextPart = {
    type: 'text';
    text: string;
} & Record<string, unknown>;

@injectable()
export default class AIUIMessageUtils {
    private isSupportedRole(role: unknown): role is AIConversationMessageRole {
        return role === AIConversationMessageRole.User
            || role === AIConversationMessageRole.Assistant
            || role === AIConversationMessageRole.System;
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

    private isTextPart(part: unknown): part is AITextPart {
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

        if (normalized.length > 0) {
            return normalized;
        }

        return null;
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
