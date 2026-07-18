// Wire response types for the ai module — the shapes the client reads back from
// `data`. `_id`, refs and dates are strings on the wire.

/** An AI conversation as the client sees it. */
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

/** A persisted AI message (user or assistant turn). Parts/model info are opaque. */
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
