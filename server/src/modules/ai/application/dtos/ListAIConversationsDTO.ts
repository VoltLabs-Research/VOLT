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
}

export interface ListAIConversationsInputDTO {
    teamId: string;
    userId: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
}
