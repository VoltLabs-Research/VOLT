import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface Notification extends BaseEntity {
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
};
