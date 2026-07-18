

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
