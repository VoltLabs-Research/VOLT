import type { AIConversation, AIConversationMessage } from '@/modules/ai/api/entities/ai-conversation';

export interface CreateAIConversationParams {
    title?: string;
    message?: string;
}

export interface CreateAIConversationResult {
    conversation: AIConversation;
    userMessage?: AIConversationMessage;
}
