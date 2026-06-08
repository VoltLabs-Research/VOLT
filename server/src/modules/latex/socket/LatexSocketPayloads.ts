export interface LatexOpenDocumentPayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
}

export interface LatexCloseDocumentPayload extends Record<string, unknown> {
    documentId: string;
}

export interface LatexUpdateContentPayload extends  Record<string, unknown> {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
    timestamp: number;
}

export interface LatexFileJoinPayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
    fileId: string;
}

export interface LatexFileLeavePayload extends Record<string, unknown> {
    documentId: string;
    fileId: string;
}

export interface LatexFileUpdatePayload extends Record<string, unknown> {
    documentId: string;
    teamId: string;
    fileId: string;
    update: number[];
}
