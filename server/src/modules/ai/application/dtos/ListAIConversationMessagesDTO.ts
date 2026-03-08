import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AIConversationMessageParts } from '@modules/ai/application/contracts/AIConversationMessage';
import type { AIMessageRole, AIMessageModelInfo, AIMessageTokenUsage } from '@modules/ai/domain/entities/AIMessage';

export interface AIMessageDTO {
    _id: string;
    conversationId: string;
    role: AIMessageRole;
    parts: AIConversationMessageParts;
    content: string;
    artifacts: { items: Record<string, unknown>[] } | null;
    modelInfo: AIMessageModelInfo | null;
    tokenUsage: AIMessageTokenUsage | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListAIConversationMessagesInputDTO {
    teamId: string;
    userId: string;
    conversationId: string;
    page?: number;
    limit?: number;
}

export interface ListAIConversationMessagesOutputDTO extends PaginatedResult<AIMessageDTO> {}
