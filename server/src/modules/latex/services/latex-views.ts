import type LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import type { LatexDocument } from '@volt/contracts/modules/latex/domain';

export const toDocumentView = (document: LatexDocumentEntity): LatexDocument => ({
    _id: document.id,
    title: document.title,
    folder: document.folder,
    createdBy: document.createdByRef ?? document.createdBy,
    lastEditedBy: document.lastEditedByRef ?? document.lastEditedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
}) as unknown as LatexDocument;
