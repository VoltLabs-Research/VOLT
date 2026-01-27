import type { User } from '@/modules/auth/domain/entities';

export interface Reaction {
    emoji: string;
    users: (User | string)[];
}

export interface Message {
    _id: string;
    chat: string;
    sender: User;
    content: string;
    messageType: 'text' | 'file' | 'system';
    isRead?: boolean;
    readBy?: (User | string)[];
    metadata?: {
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        fileUrl?: string;
        filePath?: string;
        mimetype?: string;
        [key: string]: any;
    };
    reactions?: Reaction[];
    deleted?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Chat {
    _id: string;
    participants: User[];
    team: {
        _id: string;
        name: string;
    };
    lastMessage?: Message;
    unreadCount?: number;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    admins: User[];
    createdBy?: User;
    createdAt: string;
    updatedAt: string;
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
