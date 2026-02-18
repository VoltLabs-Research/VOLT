import { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/domain/entities';

export type ChatMessageType = 'text' | 'file' | 'system';

export interface ChatMessageMetadata {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    fileUrl?: string;
    filePath?: string;
};

export interface ChatReaction {
    emoji: string;
    users: (string | User)[];
};

export interface ChatMessage extends BaseEntity {
    chat: string;
    sender: User;
    content: string;
    messageType: ChatMessageType;
    isRead: boolean;
    readBy: User[];
    metadata?: ChatMessageMetadata;
    editedAt?: string | null;
    deleted: boolean;
    deletedAt?: string | null;
    deletedBy?: User | string | null;
    reactions?: ChatReaction[];
};

export interface TypingUser {
    chatId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
};

export interface MessagesReadEvent {
    chatId: string;
    readBy: string;
    readAt: string;
};
