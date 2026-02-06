import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationCreatedPayload {
    notificationId: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link: string;
    createdAt: Date;
}

export default class NotificationCreatedEvent implements IDomainEvent {
    public readonly occurredOn: Date;
    public readonly name = 'notification.created';
    public readonly eventId: string;

    constructor(public readonly payload: NotificationCreatedPayload) {
        this.occurredOn = new Date();
        this.eventId = uuidv4();
    }
}
