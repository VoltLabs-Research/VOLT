import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface WhiteboardCreatedEventPayload {
    whiteboardId: string;
    teamId: string;
    userId: string;
    whiteboardTitle: string;
};

export default class WhiteboardCreatedEvent extends BaseDomainEvent<WhiteboardCreatedEventPayload> {
    constructor(payload: WhiteboardCreatedEventPayload) {
        super('whiteboard.created', payload);
    }
};
