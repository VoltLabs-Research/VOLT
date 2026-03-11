import type { Readable } from 'node:stream';

export interface ExportLatexDocumentInputDTO {
    teamId: string;
    documentId: string;
};

export interface ExportLatexDocumentOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
};
