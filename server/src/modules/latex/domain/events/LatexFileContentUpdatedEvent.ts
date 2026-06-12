import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface LatexFileContentUpdatedEventPayload {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
}

/**
 * Emitted when an AI tool updates a LaTeX file's content. The handler applies
 * the new content to the live server-side Yjs session (if any editor has the
 * file open) so open Monaco editors see the change without a reload. Published
 * via the (Redis) event bus so that, in a multi-instance deployment, whichever
 * instance holds the live session — not necessarily the one that served the AI
 * request — applies and broadcasts it.
 */
export default class LatexFileContentUpdatedEvent extends BaseDomainEvent<LatexFileContentUpdatedEventPayload> {
    constructor(payload: LatexFileContentUpdatedEventPayload) {
        super('latex-file.content.updated', payload);
    }
}
