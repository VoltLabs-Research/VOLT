import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface NotebookDeletedEventPayload {
    notebookId: string;
    teamId: string;
}

export default class NotebookDeletedEvent extends BaseDomainEvent<NotebookDeletedEventPayload> {
    constructor(payload: NotebookDeletedEventPayload) {
        super('notebook.deleted', payload);
    }
}
