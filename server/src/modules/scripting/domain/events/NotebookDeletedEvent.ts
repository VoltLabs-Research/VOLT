import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface NotebookDeletedEventPayload {
    notebookId: string;
    teamId: string;
}

export default class NotebookDeletedEvent implements IDomainEvent {
    public readonly name = 'notebook.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: NotebookDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
