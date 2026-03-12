import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface LatexDocumentCreatedEventPayload {
    documentId: string;
    teamId: string;
    userId: string;
    documentTitle: string;
};

export default class LatexDocumentCreatedEvent extends BaseDomainEvent<LatexDocumentCreatedEventPayload> {
    constructor(payload: LatexDocumentCreatedEventPayload) {
        super('latex-document.created', payload);
    }
};
