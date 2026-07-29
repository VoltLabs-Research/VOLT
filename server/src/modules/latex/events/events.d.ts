import type {
    LatexDocumentCreatedEventPayload,
    LatexDocumentDeletedEventPayload,
    LatexFileContentUpdatedEventPayload
} from '@modules/latex/contracts/domain/events';

declare global {
    interface EventMap {
        'latex-document.created': LatexDocumentCreatedEventPayload;
        'latex-document.deleted': LatexDocumentDeletedEventPayload;
        'latex-file.content.updated': LatexFileContentUpdatedEventPayload;
    }
}
