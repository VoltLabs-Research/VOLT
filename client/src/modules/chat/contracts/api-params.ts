export interface ChatScopedParams{
    chatId: string;
}

export interface ChatMessageScopedParams extends ChatScopedParams{
    messageId: string;
}
