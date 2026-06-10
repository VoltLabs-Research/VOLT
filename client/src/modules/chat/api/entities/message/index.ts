import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';

export enum ChatMessageType {
    Text = 'text',
    File = 'file',
    System = 'system'
}

export interface ChatMessageMetadata {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    fileUrl?: string;
    filePath?: string;
}

export interface ChatReaction {
    emoji: string;
    users: (string | User)[];
}

export interface ChatMessage extends BaseEntity {
    chat: string;
    sender: User;
    content: string;
    messageType: ChatMessageType;
    readBy: User[];
    metadata?: ChatMessageMetadata;
    deleted: boolean;
    reactions?: ChatReaction[];
}
