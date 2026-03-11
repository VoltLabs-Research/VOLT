import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface LatexDocumentDeletedEventPayload {
    documentId: string;
    teamId: string;
};

export default class LatexDocumentDeletedEvent extends BaseDomainEvent<LatexDocumentDeletedEventPayload> {
    constructor(payload: LatexDocumentDeletedEventPayload) {
        super('latex-document.deleted', payload);
    }
};
