

export interface CreateLatexDocumentInput{
    title: string;
    folderId?: string | null;
}

export interface UpdateLatexDocumentInput{
    title?: string;
}

export interface MoveLatexDocumentInput{
    folderId: string | null;
}

export interface CreateLatexFileInput{
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
}

export interface UpdateLatexFileInput{
    name?: string;
    path?: string;
    content?: string;
}

export interface UpdateLatexAssetInput{
    
    path: string;
}

export interface UploadLatexAssetFileInput{
    name: string;
    size: number;
    type?: string;
}

export interface UploadLatexAssetInput{
    
    path?: string;
    files: UploadLatexAssetFileInput[];
}

export interface CreateLatexFolderInput{
    title: string;
    parentId?: string | null;
}

export interface UpdateLatexFolderInput{
    title: string;
}
