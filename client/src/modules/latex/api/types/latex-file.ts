export interface LatexFile {
    _id: string;
    documentId: string;
    
    name: string;
    
    path: string;
    content: string;
    isEntrypoint: boolean;
    createdAt: Date;
    updatedAt: Date;
}
