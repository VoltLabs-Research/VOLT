import type { LatexDocumentCreatedEventPayload } from '@modules/latex/events/LatexDocumentCreatedEvent';
import type { LatexDocumentDeletedEventPayload } from '@modules/latex/events/LatexDocumentDeletedEvent';
import type { LatexFileContentUpdatedEventPayload } from '@modules/latex/events/LatexFileContentUpdatedEvent';

declare global {
    interface EventMap {
        'latex-document.created': LatexDocumentCreatedEventPayload;
        'latex-document.deleted': LatexDocumentDeletedEventPayload;
        'latex-file.content.updated': LatexFileContentUpdatedEventPayload;
    }
}
