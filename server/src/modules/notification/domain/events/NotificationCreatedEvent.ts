import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface NotificationCreatedPayload {
    _id: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: Date;
};

export default class NotificationCreatedEvent extends BaseDomainEvent<NotificationCreatedPayload> {
    constructor(payload: NotificationCreatedPayload) {
        super('notification.created', payload);
    }
};
