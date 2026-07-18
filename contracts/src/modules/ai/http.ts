

export interface CreateAIConversationInput{
    title?: string;
    message?: string;
}

export interface UpdateAIConversationInput{
    title?: string;
    isArchived?: boolean;
}

export interface SendAIConversationMessageInput{
    message?: string;
    messages?: unknown[];
    title?: string;
    provider?: string;
    model?: string;
}
