import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface LatexFileContentUpdatedEventPayload {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
}

export default class LatexFileContentUpdatedEvent extends BaseDomainEvent<LatexFileContentUpdatedEventPayload> {
    constructor(payload: LatexFileContentUpdatedEventPayload) {
        super('latex-file.content.updated', payload);
    }
}
