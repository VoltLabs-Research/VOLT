import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AIConversationMessageParts } from '@modules/ai/domain/contracts/AIConversationMessage';
import type { AIMessageRole, AIMessageModelInfo, AIMessageTokenUsage } from '@modules/ai/domain/entities/AIMessage';

export interface AIMessageArtifactsDTO {
    items: Record<string, unknown>[];
};

export interface AIMessageDTO {
    _id: string;
    conversationId: string;
    role: AIMessageRole;
    parts: AIConversationMessageParts;
    content: string;
    artifacts: AIMessageArtifactsDTO | null;
    modelInfo: AIMessageModelInfo | null;
    tokenUsage: AIMessageTokenUsage | null;
    createdAt: Date;
    updatedAt: Date;
};

export interface ListAIConversationMessagesInputDTO {
    teamId: string;
    userId: string;
    conversationId: string;
    page?: number;
    limit?: number;
};

export interface ListAIConversationMessagesOutputDTO extends PaginatedResult<AIMessageDTO> {}
