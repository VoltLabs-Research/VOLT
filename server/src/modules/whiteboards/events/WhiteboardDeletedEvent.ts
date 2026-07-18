import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface WhiteboardDeletedEventPayload {
    whiteboardId: string;
    teamId: string;
    userId: string;
    whiteboardTitle: string;
}

export default class WhiteboardDeletedEvent extends BaseDomainEvent<WhiteboardDeletedEventPayload> {
    constructor(payload: WhiteboardDeletedEventPayload) {
        super('whiteboard.deleted', payload);
    }
}
