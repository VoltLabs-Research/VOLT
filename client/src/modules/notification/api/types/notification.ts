import type { BaseEntity } from '@/shared/types/BaseEntity';

export interface Notification extends BaseEntity {
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
};
