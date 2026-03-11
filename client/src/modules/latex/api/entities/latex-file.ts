export interface LatexFile {
    _id: string;
    documentId: string;
    /** Filename, e.g. `main.tex`. */
    name: string;
    /** Directory prefix within the project tree, e.g. `""` (root) or `"chapters/"`. */
    path: string;
    content: string;
    isEntrypoint: boolean;
    createdAt: Date;
    updatedAt: Date;
};
