import type { UIMessage } from 'ai';
import { injectable } from 'tsyringe';

@injectable()
export default class AIUIMessageUtils {
    private isRecord(value: unknown): value is Record<string, unknown> {
        if (value === null || typeof value !== 'object') {
            return false;
        }

        return !Array.isArray(value);
    }

    private isSupportedRole(role: unknown): role is 'user' | 'assistant' | 'system' {
        return role === 'user' || role === 'assistant' || role === 'system';
    }

    private isValidUIMessage(message: unknown): message is UIMessage {
        if (!this.isRecord(message)) {
            return false;
        }

        return (
            typeof message.id === 'string'
            && this.isSupportedRole(message.role)
            && Array.isArray(message.parts)
        );
    }

    private isTextPart(part: unknown): part is { type: 'text'; text: string } {
        if (!this.isRecord(part)) {
            return false;
        }

        return part.type === 'text' && typeof part.text === 'string';
    }

    normalizeUIMessages(messages: unknown): UIMessage[] | null {
        if (!Array.isArray(messages) || messages.length === 0) {
            return null;
        }

        const normalized = messages.filter((message): message is UIMessage => this.isValidUIMessage(message));

        return normalized.length > 0 ? normalized : null;
    }

    extractLastUserMessageText(messages: UIMessage[]): string {
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
