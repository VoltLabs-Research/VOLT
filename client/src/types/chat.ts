import type { User } from '@/types/models';

export interface Chat {
    _id: string;
    participants: User[];
    team: {
        _id: string;
        name: string;
    };
    lastMessage?: Message;
    lastMessageAt?: string;
    isActive: boolean;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    groupAvatar?: string;
    admins: User[];
    createdBy?: User;
    createdAt: string;
    updatedAt: string;
}

export type Reaction = {
    emoji: string;
    users: Array<string | { _id: string; userName?: string }>;
};

export interface Message {
    _id: string;
    chat: string;
    sender: User;
    content: string;
    messageType: 'text' | 'file' | 'system';
    isRead: boolean;
    readBy: User[];
    metadata?: {
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        fileUrl?: string;
        filePath?: string;
    };
    editedAt?: string | null;
    deleted?: boolean;
    deletedAt?: string | null;
    deletedBy?: User | string | null;
    reactions?: { emoji: string; users: (User | string)[] }[];
    createdAt: string;
    updatedAt: string;
}

export interface ChatMessage {
    message: Message;
    chatId: string;
}

export interface TypingUser {
    chatId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
}

export interface MessagesRead {
    chatId: string;
    readBy: string;
    readAt: string;
}

export type Participant = {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
};

export type Presence = 'online' | 'offline' | 'connecting';
