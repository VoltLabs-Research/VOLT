// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:conversationId` path params) is NOT
// here — the service augments those on its own input.

export interface CreateAIConversationInput{
    title?: string;
    message?: string;
}

export interface UpdateAIConversationInput{
    title?: string;
    isArchived?: boolean;
}

/**
 * Body of the streaming send-message endpoint. `messages` is the client's
 * running UI-message history (Excalidraw-style parts) — opaque on the wire and
 * normalized server-side, so typed as a free-form array.
 */
export interface SendAIConversationMessageInput{
    message?: string;
    messages?: unknown[];
    title?: string;
    provider?: string;
    model?: string;
}
