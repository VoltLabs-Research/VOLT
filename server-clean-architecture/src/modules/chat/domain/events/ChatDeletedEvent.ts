import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface ChatDeletedEventPayload {
    chatId: string;
    teamId: string;
};

export default class ChatDeletedEvent implements IDomainEvent {
    public readonly name = 'chat.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: ChatDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};
