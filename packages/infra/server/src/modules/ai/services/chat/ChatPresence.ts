// The sockets joined to each conversation, in the order they joined. A conversation belongs to one
// user, so every socket here is that user's: the most recent one is the tab they are looking at.
class ChatPresence {
    #byConversation = new Map<string, Set<string>>();
    #bySocket = new Map<string, Set<string>>();

    join(socketId: string, conversationId: string): void {
        const sockets = this.#byConversation.get(conversationId) ?? new Set<string>();
        sockets.delete(socketId);
        sockets.add(socketId);
        this.#byConversation.set(conversationId, sockets);

        const conversations = this.#bySocket.get(socketId) ?? new Set<string>();
        conversations.add(conversationId);
        this.#bySocket.set(socketId, conversations);
    }

    leave(socketId: string, conversationId: string): void {
        const sockets = this.#byConversation.get(conversationId);
        sockets?.delete(socketId);
        if (sockets?.size === 0) this.#byConversation.delete(conversationId);

        const conversations = this.#bySocket.get(socketId);
        conversations?.delete(conversationId);
        if (conversations?.size === 0) this.#bySocket.delete(socketId);
    }

    drop(socketId: string): void {
        for (const conversationId of this.#bySocket.get(socketId) ?? []) this.leave(socketId, conversationId);
    }

    isJoined(socketId: string, conversationId: string): boolean {
        return this.#byConversation.get(conversationId)?.has(socketId) === true;
    }

    driverOf(conversationId: string, preferred: string | null): string | null {
        const sockets = this.#byConversation.get(conversationId);
        if (sockets === undefined || sockets.size === 0) return null;
        if (preferred !== null && sockets.has(preferred)) return preferred;

        return [...sockets][sockets.size - 1] ?? null;
    }
}

export default new ChatPresence();
