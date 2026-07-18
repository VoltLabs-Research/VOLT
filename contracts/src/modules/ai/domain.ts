

export interface AIConversation{
    _id: string;
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: string | null;
    lastProvider?: string | null;
    lastModel?: string | null;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AIMessage{
    _id: string;
    conversationId: string;
    role: string;
    parts: unknown[];
    content: string;
    artifacts: { items: Record<string, unknown>[] } | null;
    modelInfo: Record<string, unknown> | null;
    tokenUsage: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAIConversationResponse{
    conversation: AIConversation;
    userMessage?: AIMessage;
}
