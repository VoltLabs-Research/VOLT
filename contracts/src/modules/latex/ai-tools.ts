import type { tags } from 'typia';

export interface LatexDocumentRefInput{
    documentId: string;
}

export interface LatexFileRefInput{
    documentId: string;
    fileId: string;
}

export interface CreateLatexDocumentInput{
    title: string;
    folderId?: string | null;
}

export interface ListLatexDocumentsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    search?: string;
    folderId?: string;
}

export interface UpdateLatexDocumentInput{
    documentId: string;
    title?: string;
}

export interface MoveLatexDocumentInput{
    documentId: string;
    folderId: string | null;
}

export interface CreateLatexFileInput{
    documentId: string;
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
}

export interface UpdateLatexFileInput{
    documentId: string;
    fileId: string;
    name?: string;
    path?: string;
    content?: string;
}

export interface ManageLatexAssetsInput{
    documentId: string;
    action: 'list' | 'export';
    format?: 'tex' | 'zip';
}
