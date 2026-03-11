import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface WhiteboardDeletedEventPayload {
    whiteboardId: string;
    teamId: string;
};

export default class WhiteboardDeletedEvent extends BaseDomainEvent<WhiteboardDeletedEventPayload> {
    constructor(payload: WhiteboardDeletedEventPayload) {
        super('whiteboard.deleted', payload);
    }
};
