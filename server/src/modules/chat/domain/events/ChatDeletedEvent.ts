import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface ChatDeletedEventPayload {
    chatId: string;
    teamId: string;
};

export default class ChatDeletedEvent extends BaseDomainEvent<ChatDeletedEventPayload> {
    constructor(payload: ChatDeletedEventPayload) {
        super('chat.deleted', payload);
    }
};
