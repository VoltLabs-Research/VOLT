// Wire response types for the chat module — the shapes the client reads back
// from `data`. `_id`, refs and dates are strings on the wire; populated refs
// (participants, lastMessage, sender) may be nested objects, so they are typed
// as `unknown` where the server may return either an id or a populated document.

export type ChatMessageKind = 'text' | 'file';

export interface ChatMessageMetadata{
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    filePath: string;
}

export interface ChatReaction{
    emoji: string;
    users: string[];
}

/** A chat message as the client sees it (`sender` may be a populated user). */
export interface PersistedChatMessage{
    _id: string;
    chat: string;
    sender: unknown;
    content: string;
    messageType: ChatMessageKind;
    readBy: string[];
    metadata?: ChatMessageMetadata;
    deleted: boolean;
    reactions: ChatReaction[];
    createdAt: string;
    updatedAt: string;
}

/** A chat as the client sees it (participants / lastMessage may be populated). */
export interface PersistedChat{
    _id: string;
    participants: unknown;
    team: unknown;
    lastMessage?: unknown;
    lastMessageAt?: string;
    isActive: boolean;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    admins: string[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
