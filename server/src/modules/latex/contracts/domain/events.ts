export interface LatexDocumentCreatedEventPayload{
    documentId: string;
    teamId: string;
    userId: string;
    documentTitle: string;
}

export interface LatexDocumentDeletedEventPayload{
    documentId: string;
    teamId: string;
    storageClusterId?: string;
    userId: string;
    documentTitle: string;
}

export interface LatexFileContentUpdatedEventPayload{
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
}
