import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';

export interface ImportLatexDocumentParams {
    file: File;
    folderId?: string | null;
};

export type ImportLatexDocumentResult = LatexDocument;
