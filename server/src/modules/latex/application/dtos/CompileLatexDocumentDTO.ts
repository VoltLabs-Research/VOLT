import type { Readable } from 'node:stream';

export interface CompileLatexDocumentInputDTO {
    teamId: string;
    documentId: string;
};

export interface CompileLatexDocumentOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
};
