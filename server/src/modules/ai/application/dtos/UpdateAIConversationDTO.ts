export interface UpdateAIConversationInputDTO {
    teamId: string;
    userId: string;
    conversationId: string;
    title?: string;
    isArchived?: boolean;
};
