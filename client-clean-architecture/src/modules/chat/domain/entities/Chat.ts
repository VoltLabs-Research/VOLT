import type { User } from '@/modules/auth/domain/entities';

export interface Chat {
    _id: string;
    participants: User[];
    team: string | { _id: string; name: string };
    lastMessage?: {
        _id: string;
        content: string;
        sender: User;
        createdAt: string;
    };
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
};
