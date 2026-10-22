
export interface AIToolScope {
    teamId: string;
    userId: string;
    // The conversation the call comes from; tool inputs may name other conversations.
    currentConversationId: string;
}
