import type { BaseEntity } from '../../shared/base';

export interface Notification extends BaseEntity{
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
}
