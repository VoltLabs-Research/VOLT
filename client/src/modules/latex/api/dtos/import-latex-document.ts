import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';

export interface ImportLatexDocumentParams {
    file: File;
};

export type ImportLatexDocumentResult = LatexDocument;
