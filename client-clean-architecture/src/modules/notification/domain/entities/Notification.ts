import type { User } from '@/modules/auth/domain/entities';


export interface Notification {
    _id: string;
    recipient: User | string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
}
