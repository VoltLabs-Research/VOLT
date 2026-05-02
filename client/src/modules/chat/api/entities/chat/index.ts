import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';

export interface ChatTeamReference {
    _id: string;
    name: string;
}

export interface ChatLastMessage {
    _id: string;
    content: string;
    sender: User;
    createdAt: string;
}

export interface Chat extends BaseEntity {
    participants: User[];
    team: string | ChatTeamReference;
    lastMessage?: ChatLastMessage;
    lastMessageAt?: string;
    isActive: boolean;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    groupAvatar?: string;
    admins: User[];
    createdBy?: User;
}
