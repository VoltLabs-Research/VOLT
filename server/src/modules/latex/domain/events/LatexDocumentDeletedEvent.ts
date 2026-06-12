import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface LatexDocumentDeletedEventPayload {
    documentId: string;
    teamId: string;
    storageClusterId?: string;
    userId: string;
    documentTitle: string;
}

export default class LatexDocumentDeletedEvent extends BaseDomainEvent<LatexDocumentDeletedEventPayload> {
    constructor(payload: LatexDocumentDeletedEventPayload) {
        super('latex-document.deleted', payload);
    }
}
