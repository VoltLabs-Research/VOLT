import type { BaseEntity } from '../../shared/base';

export interface Notification extends BaseEntity{
    title: string;
    content: string;
    read: boolean;
    link?: string;
}
