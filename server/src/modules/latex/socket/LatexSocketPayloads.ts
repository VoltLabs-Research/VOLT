export interface LatexOpenDocumentPayload {
    documentId: string;
    teamId: string;
}

export interface LatexCloseDocumentPayload {
    documentId: string;
}

export interface LatexUpdateContentPayload {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
    timestamp: number;
}

export interface LatexFileJoinPayload {
    documentId: string;
    teamId: string;
    fileId: string;
}

export interface LatexFileLeavePayload {
    documentId: string;
    fileId: string;
}

export interface LatexFileUpdatePayload {
    documentId: string;
    teamId: string;
    fileId: string;
    update: number[];
}
