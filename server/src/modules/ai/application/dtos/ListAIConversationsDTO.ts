import { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface AIConversationDTO {
    _id: string;
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: Date | null;
    lastProvider?: string | null;
    lastModel?: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export interface ListAIConversationsInputDTO {
    teamId: string;
    userId: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
};

export interface ListAIConversationsOutputDTO extends PaginatedResult<AIConversationDTO> { }
