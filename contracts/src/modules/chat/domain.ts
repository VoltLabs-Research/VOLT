import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';

export enum ChatMessageType{
    Text = 'text',
    File = 'file',
    System = 'system'
}

export enum PresenceStatus{
    Online = 'online',
    Offline = 'offline',
    Unknown = 'unknown'
}

export interface ChatMessageMetadata{
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    fileUrl?: string;
    filePath?: string;
}

export interface ChatReaction{
    emoji: string;
    users: Ref<User>[];
}

export interface ChatTeamReference{
    _id: string;
    name: string;
}

export interface ChatLastMessage{
    _id: string;
    content: string;
    sender: User;
    createdAt: string;
}

export interface Chat extends BaseEntity{
    participants: User[];
    team: Ref<ChatTeamReference>;
    lastMessage?: ChatLastMessage;
    lastMessageAt?: string;
    isActive: boolean;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    admins: User[];
    createdBy?: User;
}

export interface ChatMessage extends BaseEntity{
    chat: string;
    sender: User;
    content: string;
    messageType: ChatMessageType;
    readBy: User[];
    metadata?: ChatMessageMetadata;
    deleted: boolean;
    reactions?: ChatReaction[];
}

export interface TypingUser{
    chatId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
}
